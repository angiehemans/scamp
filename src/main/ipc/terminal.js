import { BrowserWindow, ipcMain } from 'electron';
import * as pty from 'node-pty';
import { IPC } from '@shared/ipcChannels';
// In dev we allow more concurrent ptys than the user can actually open
// from the UI (MAX_TABS = 3). HMR re-mounts TerminalView without always
// running its cleanup, so orphaned ptys stack up across reloads until
// they hit the cap and the next createTerminal call fails. A higher cap
// in dev gives the user breathing room before they have to reload the
// window. Production keeps the strict limit since there's no HMR.
const MAX_TERMINALS = process.env['NODE_ENV'] === 'development' ? 12 : 3;
const terminals = new Map();
let nextId = 1;
const defaultShell = () => {
    if (process.platform === 'win32') {
        return process.env['COMSPEC'] ?? 'cmd.exe';
    }
    return process.env['SHELL'] ?? '/bin/bash';
};
const findWindow = () => {
    const wins = BrowserWindow.getAllWindows();
    return wins[0] ?? null;
};
const createTerminal = (args) => {
    if (terminals.size >= MAX_TERMINALS) {
        // Log loudly so the dev knows orphans piled up — not just a quiet
        // IPC rejection in the renderer console.
        console.error(`[terminal] limit reached: ${terminals.size}/${MAX_TERMINALS} ptys alive. ` +
            `Reload the window to clear them.`);
        throw new Error(`Terminal limit reached (${MAX_TERMINALS}). Reload the window to clear orphaned shells.`);
    }
    const id = String(nextId++);
    const proc = pty.spawn(defaultShell(), [], {
        name: 'xterm-256color',
        cols: Math.max(args.cols, 1),
        rows: Math.max(args.rows, 1),
        cwd: args.cwd,
        env: { ...process.env, TERM: 'xterm-256color' },
    });
    proc.onData((data) => {
        const win = findWindow();
        if (!win)
            return;
        const payload = { id, data };
        win.webContents.send(IPC.TerminalData, payload);
    });
    proc.onExit(({ exitCode }) => {
        const win = findWindow();
        terminals.delete(id);
        if (!win)
            return;
        const payload = { id, exitCode };
        win.webContents.send(IPC.TerminalExit, payload);
    });
    terminals.set(id, { id, proc });
    return { id };
};
const writeTerminal = (args) => {
    const term = terminals.get(args.id);
    if (!term)
        return;
    term.proc.write(args.data);
};
const resizeTerminal = (args) => {
    const term = terminals.get(args.id);
    if (!term)
        return;
    try {
        term.proc.resize(Math.max(args.cols, 1), Math.max(args.rows, 1));
    }
    catch {
        // node-pty throws if the process is already gone — safe to ignore.
    }
};
const killTerminal = (args) => {
    const term = terminals.get(args.id);
    if (!term)
        return;
    try {
        term.proc.kill();
    }
    catch {
        // already exited
    }
    terminals.delete(args.id);
};
export const disposeAllTerminals = () => {
    for (const term of terminals.values()) {
        try {
            term.proc.kill();
        }
        catch {
            // ignore
        }
    }
    terminals.clear();
};
export const registerTerminalIpc = () => {
    ipcMain.handle(IPC.TerminalCreate, (_e, args) => createTerminal(args));
    ipcMain.handle(IPC.TerminalWrite, (_e, args) => writeTerminal(args));
    ipcMain.handle(IPC.TerminalResize, (_e, args) => resizeTerminal(args));
    ipcMain.handle(IPC.TerminalKill, (_e, args) => killTerminal(args));
};
