import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { DevServerStatus } from '@shared/types';
import { allocateFreePort } from './portAlloc';
import { detectReady } from './readyDetector';

/** Cap on log lines kept per server so memory doesn't grow without bound. */
const MAX_LOG_LINES = 1000;

/** SIGTERM grace period before falling back to SIGKILL on stop. */
const KILL_GRACE_MS = 2000;

type Listener = (status: DevServerStatus) => void;

type Entry = {
  projectPath: string;
  status: DevServerStatus;
  process: ChildProcess | null;
  logs: string[];
  listeners: Set<Listener>;
};

const entries = new Map<string, Entry>();

const setStatus = (entry: Entry, status: DevServerStatus): void => {
  entry.status = status;
  for (const listener of entry.listeners) {
    try {
      listener(status);
    } catch (err) {
      console.warn('[devServerManager] listener threw:', err);
    }
  }
};

const appendLog = (entry: Entry, chunk: string): void => {
  // Split on newline, drop empty trailing line, push each.
  for (const line of chunk.split(/\r?\n/)) {
    if (line.length === 0) continue;
    entry.logs.push(line);
  }
  // Cap log retention.
  if (entry.logs.length > MAX_LOG_LINES) {
    entry.logs.splice(0, entry.logs.length - MAX_LOG_LINES);
  }
};

/**
 * True when the project has a `node_modules` directory. Used to
 * decide whether `npm install` needs to run on first preview open.
 */
const nodeModulesExists = async (projectPath: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(join(projectPath, 'node_modules'));
    return stat.isDirectory();
  } catch {
    return false;
  }
};

/**
 * Spawn `npm install` in the project folder. Resolves when the
 * process exits 0; rejects on non-zero exit. Streams output into
 * the entry's logs so the preview window can show progress.
 */
const runNpmInstall = (entry: Entry): Promise<void> => {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['install'], {
      cwd: entry.projectPath,
      env: process.env,
      // Pipe stdio so we can capture; npm install isn't interactive
      // when run with no extra prompts.
      stdio: ['ignore', 'pipe', 'pipe'],
      // On Windows `npm` is a .cmd shim — `shell: true` lets the OS
      // resolve it via PATH the same way as a manual terminal run.
      shell: process.platform === 'win32',
    });
    entry.process = proc;
    setStatus(entry, { kind: 'installing', logs: entry.logs });

    proc.stdout?.on('data', (data: Buffer) => {
      appendLog(entry, data.toString('utf8'));
      // Refresh status so listeners see updated logs.
      setStatus(entry, { kind: 'installing', logs: entry.logs });
    });
    proc.stderr?.on('data', (data: Buffer) => {
      appendLog(entry, data.toString('utf8'));
      setStatus(entry, { kind: 'installing', logs: entry.logs });
    });
    proc.on('exit', (code) => {
      entry.process = null;
      if (code === 0) {
        resolve();
      } else {
        appendLog(entry, `npm install exited with code ${code ?? 'null'}`);
        reject(new Error(`npm install failed with exit code ${code}`));
      }
    });
    proc.on('error', (err) => {
      entry.process = null;
      appendLog(entry, `Failed to spawn npm install: ${err.message}`);
      reject(err);
    });
  });
};

/**
 * Spawn `next dev` on a free port and wait for the ready signal.
 * Resolves with the port once the server is accepting requests.
 */
const startNextDev = async (entry: Entry): Promise<number> => {
  const port = await allocateFreePort();
  const proc = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
    cwd: entry.projectPath,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  entry.process = proc;
  setStatus(entry, { kind: 'starting', port, logs: entry.logs });

  // Use a buffer to handle ready-line detection across chunk boundaries.
  let stdoutBuffer = '';
  let resolved = false;
  return await new Promise<number>((resolve, reject) => {
    const check = (chunk: string): void => {
      stdoutBuffer += chunk;
      // Trim the buffer to a sensible size — only need the recent tail
      // to find the ready line.
      if (stdoutBuffer.length > 4096) {
        stdoutBuffer = stdoutBuffer.slice(-4096);
      }
      if (!resolved && detectReady(stdoutBuffer)) {
        resolved = true;
        setStatus(entry, { kind: 'ready', port, logs: entry.logs });
        resolve(port);
      }
    };

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      appendLog(entry, text);
      check(text);
      // Only broadcast status while we're still starting up so the
      // install/start spinner can refresh its log tail. After we
      // reach `ready`, every line of `next dev`'s output (HMR
      // notices, request logs, etc.) would otherwise re-fire the
      // status push — which makes the renderer re-navigate the
      // webview to the same URL and produce a flood of
      // `ERR_ABORTED` loads. The ready transition itself is
      // emitted by `check()` above when the ready signal arrives.
      if (!resolved) {
        setStatus(entry, { kind: 'starting', port, logs: entry.logs });
      }
    });
    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      appendLog(entry, text);
      // Some `next dev` versions print "Local:" to stderr; check both.
      check(text);
    });
    proc.on('exit', (code) => {
      entry.process = null;
      const exitCode = code ?? -1;
      if (!resolved) {
        appendLog(entry, `next dev exited before becoming ready (code ${exitCode})`);
        setStatus(entry, {
          kind: 'crashed',
          logs: entry.logs,
          exitCode,
        });
        reject(new Error(`next dev failed (exit ${exitCode})`));
        return;
      }
      // Crashed after ready — flip to crashed so the preview UI can
      // surface the restart affordance.
      setStatus(entry, {
        kind: 'crashed',
        logs: entry.logs,
        exitCode,
      });
    });
    proc.on('error', (err) => {
      entry.process = null;
      appendLog(entry, `Failed to spawn next dev: ${err.message}`);
      if (!resolved) reject(err);
    });
  });
};

/**
 * Start (or reuse) a dev server for the given project. Idempotent —
 * concurrent calls share the same in-flight startup.
 */
const inflightStarts = new Map<string, Promise<void>>();

export const ensureDevServer = async (projectPath: string): Promise<DevServerStatus> => {
  const existing = entries.get(projectPath);
  if (existing) {
    if (existing.status.kind === 'ready' || existing.status.kind === 'starting' || existing.status.kind === 'installing') {
      // Either ready or in-flight; await any pending start and return.
      const inflight = inflightStarts.get(projectPath);
      if (inflight) await inflight;
      return existing.status;
    }
    // crashed / idle — fall through and re-start using the existing entry.
  }

  const entry: Entry =
    existing ??
    {
      projectPath,
      status: { kind: 'idle' },
      process: null,
      logs: [],
      listeners: new Set(),
    };
  if (!existing) entries.set(projectPath, entry);
  // Reset transient state for a fresh start.
  entry.process = null;

  const promise = (async () => {
    try {
      if (!(await nodeModulesExists(projectPath))) {
        await runNpmInstall(entry);
      }
      await startNextDev(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendLog(entry, message);
      // startNextDev / runNpmInstall already set crashed status on
      // failure; this catch is defensive.
      if (entry.status.kind !== 'crashed') {
        setStatus(entry, {
          kind: 'crashed',
          logs: entry.logs,
          exitCode: -1,
        });
      }
    } finally {
      inflightStarts.delete(projectPath);
    }
  })();
  inflightStarts.set(projectPath, promise);
  await promise;
  return entry.status;
};

/**
 * Kill the dev server for a project and remove it from the cache.
 * Safe to call when no server is running.
 */
export const stopDevServer = async (projectPath: string): Promise<void> => {
  const entry = entries.get(projectPath);
  if (!entry) return;
  const proc = entry.process;
  entries.delete(projectPath);
  if (!proc) return;
  // Best-effort graceful shutdown. SIGTERM, then SIGKILL after a grace
  // period if the process is still around.
  try {
    proc.kill('SIGTERM');
  } catch {
    // Already dead — fine.
  }
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Already dead.
      }
      resolve();
    }, KILL_GRACE_MS);
    proc.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
};

/**
 * Stop every dev server. Used on app quit and when the user closes
 * a project (kills only that project's servers — see lifecycle
 * wiring in main/index.ts).
 */
export const stopAllDevServers = async (): Promise<void> => {
  const paths = Array.from(entries.keys());
  await Promise.all(paths.map(stopDevServer));
};

/** Current status snapshot, or `idle` when no entry exists. */
export const getDevServerStatus = (projectPath: string): DevServerStatus => {
  const entry = entries.get(projectPath);
  if (!entry) return { kind: 'idle' };
  return entry.status;
};

/**
 * Subscribe to status changes for a project. Returns an unsubscribe
 * function. Auto-creates an entry so the preview window can listen
 * before `ensureDevServer` is invoked (avoids a race on first open).
 */
export const subscribeDevServer = (
  projectPath: string,
  listener: Listener
): (() => void) => {
  let entry = entries.get(projectPath);
  if (!entry) {
    entry = {
      projectPath,
      status: { kind: 'idle' },
      process: null,
      logs: [],
      listeners: new Set(),
    };
    entries.set(projectPath, entry);
  }
  entry.listeners.add(listener);
  return () => {
    entry?.listeners.delete(listener);
  };
};

/**
 * Restart a crashed (or running) dev server for a project. Stops
 * the existing process and re-runs `ensureDevServer`. Used by the
 * preview window's Restart button.
 */
export const restartDevServer = async (
  projectPath: string
): Promise<DevServerStatus> => {
  await stopDevServer(projectPath);
  return await ensureDevServer(projectPath);
};
