import { BrowserWindow, ipcMain } from 'electron';
import * as pty from 'node-pty';
import { IPC } from '@shared/ipcChannels';
import type {
  TerminalCreateArgs,
  TerminalCreateResult,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalForegroundProcessPayload,
  TerminalKillArgs,
  TerminalResizeArgs,
  TerminalWriteArgs,
} from '@shared/types';
import {
  readForeground,
  shellBaseName,
  supportsForegroundDetection,
} from './terminalForeground';

// In dev we allow more concurrent ptys than the user can actually open
// from the UI (MAX_TABS = 3). HMR re-mounts TerminalView without always
// running its cleanup, so orphaned ptys stack up across reloads until
// they hit the cap and the next createTerminal call fails. A higher cap
// in dev gives the user breathing room before they have to reload the
// window. Production keeps the strict limit since there's no HMR.
const MAX_TERMINALS = process.env['NODE_ENV'] === 'development' ? 12 : 3;

type Term = {
  id: string;
  proc: pty.IPty;
  /** Polling timer for the foreground-process detection. Null when
   *  detection isn't supported on the current OS (Phase 4.4). */
  foregroundTimer: ReturnType<typeof setInterval> | null;
  /** Last reported foreground command name, used to debounce IPC
   *  events. Only emit when the state actually changes. */
  lastForeground: string | null;
};

const terminals = new Map<string, Term>();
let nextId = 1;

/**
 * Poll cadence for the foreground-process detector. 500ms keeps
 * the latency between "user types `claude`" and "Scamp shows
 * Paused" well under a second without bothering the OS. The
 * polling does one or two cheap /proc reads per terminal per tick.
 */
const FOREGROUND_POLL_MS = 500;

const defaultShell = (): string => {
  if (process.platform === 'win32') {
    return process.env['COMSPEC'] ?? 'cmd.exe';
  }
  return process.env['SHELL'] ?? '/bin/bash';
};

const findWindow = (): BrowserWindow | null => {
  const wins = BrowserWindow.getAllWindows();
  return wins[0] ?? null;
};

const createTerminal = (args: TerminalCreateArgs): TerminalCreateResult => {
  if (terminals.size >= MAX_TERMINALS) {
    // Log loudly so the dev knows orphans piled up — not just a quiet
    // IPC rejection in the renderer console.
    console.error(
      `[terminal] limit reached: ${terminals.size}/${MAX_TERMINALS} ptys alive. ` +
        `Reload the window to clear them.`
    );
    throw new Error(
      `Terminal limit reached (${MAX_TERMINALS}). Reload the window to clear orphaned shells.`
    );
  }
  const id = String(nextId++);
  const proc = pty.spawn(defaultShell(), [], {
    name: 'xterm-256color',
    cols: Math.max(args.cols, 1),
    rows: Math.max(args.rows, 1),
    cwd: args.cwd,
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
  });

  proc.onData((data) => {
    const win = findWindow();
    if (!win) return;
    const payload: TerminalDataPayload = { id, data };
    win.webContents.send(IPC.TerminalData, payload);
  });

  proc.onExit(({ exitCode }) => {
    const term = terminals.get(id);
    if (term?.foregroundTimer) clearInterval(term.foregroundTimer);
    const win = findWindow();
    terminals.delete(id);
    if (!win) return;
    const payload: TerminalExitPayload = { id, exitCode };
    win.webContents.send(IPC.TerminalExit, payload);
  });

  const term: Term = { id, proc, foregroundTimer: null, lastForeground: null };
  terminals.set(id, term);
  startForegroundPolling(term);
  return { id };
};

/**
 * Begin polling this pty's foreground command. Emits an IPC event
 * each time the value changes (idle → busy → idle). Skipped on
 * platforms that don't expose the necessary syscalls (Phase 4.4).
 */
const startForegroundPolling = (term: Term): void => {
  if (!supportsForegroundDetection()) {
    // eslint-disable-next-line no-console
    console.log(
      `[terminal] foreground detection unsupported on ${process.platform} — sync auto-pause disabled for this pty.`
    );
    return;
  }
  const baseName = shellBaseName(defaultShell());
  // eslint-disable-next-line no-console
  console.log(
    `[terminal ${term.id}] starting foreground polling (shell pid=${term.proc.pid}, baseName=${baseName})`
  );
  const tick = async (): Promise<void> => {
    // The process may have exited between ticks.
    if (!terminals.has(term.id)) return;
    const next = await readForeground(term.proc.pid, baseName);
    if (next === term.lastForeground) return;
    term.lastForeground = next;
    // eslint-disable-next-line no-console
    console.log(
      `[terminal ${term.id}] foreground changed → ${next ?? '(idle shell)'}`
    );
    const win = findWindow();
    if (!win) return;
    const payload: TerminalForegroundProcessPayload = {
      id: term.id,
      processName: next,
    };
    win.webContents.send(IPC.TerminalForegroundProcess, payload);
  };
  // Kick off one immediate read so the renderer doesn't wait the
  // full poll interval for the initial value.
  void tick();
  term.foregroundTimer = setInterval(() => void tick(), FOREGROUND_POLL_MS);
};

const writeTerminal = (args: TerminalWriteArgs): void => {
  const term = terminals.get(args.id);
  if (!term) return;
  term.proc.write(args.data);
};

const resizeTerminal = (args: TerminalResizeArgs): void => {
  const term = terminals.get(args.id);
  if (!term) return;
  try {
    term.proc.resize(Math.max(args.cols, 1), Math.max(args.rows, 1));
  } catch {
    // node-pty throws if the process is already gone — safe to ignore.
  }
};

const killTerminal = (args: TerminalKillArgs): void => {
  const term = terminals.get(args.id);
  if (!term) return;
  if (term.foregroundTimer) clearInterval(term.foregroundTimer);
  try {
    term.proc.kill();
  } catch {
    // already exited
  }
  terminals.delete(args.id);
};

// SIGTERM grace period before falling back to SIGKILL on shutdown.
// Mirrors devServerManager's pattern — a polite signal first, then a
// hard kill if the shell didn't exit (e.g. shell trapped SIGTERM, or
// a child process is holding the pty open).
const KILL_GRACE_MS = 1500;

const killAndWait = (term: Term): Promise<void> =>
  new Promise<void>((resolve) => {
    let done = false;
    let killTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
      if (done) return;
      done = true;
      if (killTimer) clearTimeout(killTimer);
      resolve();
    };

    term.proc.onExit(() => finish());

    killTimer = setTimeout(() => {
      try {
        term.proc.kill('SIGKILL');
      } catch {
        // already dead
      }
      // SIGKILL is delivered immediately, but give libuv a tick to
      // close the pty file descriptors before resolving — those open
      // FDs are what keep the event loop alive past app.quit().
      setTimeout(finish, 100);
    }, KILL_GRACE_MS);

    try {
      term.proc.kill('SIGTERM');
    } catch {
      // Process already exited — onExit may not fire if we attached
      // after it died, so resolve here.
      finish();
    }
  });

/**
 * Kill every live pty and wait for the OS to release its file
 * descriptors. Awaiting this is what lets the Electron process exit
 * cleanly on quit — see the `before-quit` handler in `src/main/index.ts`.
 * Calling twice is safe: the map is cleared synchronously up front.
 */
export const disposeAllTerminals = async (): Promise<void> => {
  const all = Array.from(terminals.values());
  for (const term of all) {
    if (term.foregroundTimer) clearInterval(term.foregroundTimer);
  }
  terminals.clear();
  await Promise.all(all.map(killAndWait));
};

export const registerTerminalIpc = (): void => {
  ipcMain.handle(IPC.TerminalCreate, (_e, args: TerminalCreateArgs) => createTerminal(args));
  ipcMain.handle(IPC.TerminalWrite, (_e, args: TerminalWriteArgs) => writeTerminal(args));
  ipcMain.handle(IPC.TerminalResize, (_e, args: TerminalResizeArgs) => resizeTerminal(args));
  ipcMain.handle(IPC.TerminalKill, (_e, args: TerminalKillArgs) => killTerminal(args));
};

// Expose dispose to E2E tests so the Playwright fixture can pre-clean
// ptys before `app.close()`. The global is only attached in test mode
// to keep the production surface clean.
if (process.env['SCAMP_E2E'] === '1') {
  (globalThis as { __scampDisposeTerminals?: () => Promise<void> }).__scampDisposeTerminals =
    disposeAllTerminals;
}
