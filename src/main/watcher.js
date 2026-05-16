import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import { extname, basename, dirname, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import { createPendingWriteTracker, } from './pendingWrites';
let watcher = null;
let mainWindow = null;
let watchedPath = null;
const ACK_EXPIRY_MS = 400;
/**
 * Tracks paths the renderer has just written, pending a chokidar
 * stability event. On a matching event we emit `file:writeAck` so the
 * save-status indicator can transition, and (for page writes)
 * suppress the `file:changed` broadcast so the renderer doesn't
 * re-parse its own output.
 */
const pending = createPendingWriteTracker((payload) => {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    mainWindow.webContents.send(IPC.FileWriteAck, payload);
}, ACK_EXPIRY_MS);
export const initWatcher = (win) => {
    mainWindow = win;
};
export const disposeWatcher = () => {
    if (watcher) {
        void watcher.close();
        watcher = null;
    }
    watchedPath = null;
};
export const watchProject = async (folderPath) => {
    if (watcher) {
        await watcher.close();
        watcher = null;
    }
    watchedPath = folderPath;
    watcher = chokidar.watch(folderPath, {
        // Ignore dotfiles and `node_modules` (Next.js projects acquire one
        // as soon as the user runs `npm install`; chokidar would thrash
        // walking it). Depth=3 covers the deepest path Scamp cares about:
        // `<projectRoot> → app → <page-folder> → page.tsx`.
        ignored: [/(^|[\/\\])\../, /(^|[\/\\])node_modules([\/\\]|$)/],
        persistent: true,
        ignoreInitial: true,
        depth: 3,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 50,
        },
    });
    const handleChange = (changedPath) => {
        void emitChange(changedPath);
    };
    // `add` and `unlink` may indicate a new / removed page. Run the
    // same `emitChange` logic (so the renderer's syncBridge sees a
    // `file:changed` event for the active page when it gets
    // recreated) AND broadcast a separate `project:pages-changed`
    // event so the page navigator refreshes its list.
    //
    // We don't try to distinguish in-app writes from external ones —
    // the renderer re-reads the project on this event and compares
    // page-name sets, so a no-op refresh is harmless. The pending
    // write tracker still suppresses `file:changed` for the
    // renderer's own page saves.
    const handleAddOrUnlink = (changedPath) => {
        void emitChange(changedPath);
        maybeNotifyPagesChanged(changedPath);
    };
    watcher.on('add', handleAddOrUnlink);
    watcher.on('unlink', handleAddOrUnlink);
    watcher.on('change', handleChange);
};
/**
 * Page files always end in `.tsx` or `.module.css`. Filter here
 * so the renderer isn't woken up for unrelated file system noise
 * (config edits, log files, etc.).
 */
const maybeNotifyPagesChanged = (changedPath) => {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    const isTsx = extname(changedPath) === '.tsx';
    const isCss = changedPath.endsWith('.module.css');
    if (!isTsx && !isCss)
        return;
    mainWindow.webContents.send(IPC.ProjectPagesChanged);
};
export const registerPendingWrite = (path, writeId, suppressChanged) => {
    pending.register(path, writeId, suppressChanged);
};
/**
 * Cancel a previously registered pending write — used when the write
 * itself failed, so no ack ever gets emitted (the renderer will
 * transition to `error` via the IPC rejection path instead).
 */
export const cancelPendingWrite = (path) => {
    pending.cancel(path);
};
/**
 * Legacy suppression entry-point for flows that have no save-status
 * indicator to acknowledge (e.g. page rename). Registers a pending
 * write with a throwaway id — the renderer isn't listening for it.
 */
export const suppressNextChange = (path) => {
    pending.register(path, `suppress-${Date.now()}`, true);
};
const emitChange = async (changedPath) => {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    // Consume any pending-write entry first. The tracker emits the ack
    // regardless; we only need to decide whether to forward the
    // `file:changed` broadcast too.
    const consumed = pending.consume(changedPath);
    if (consumed?.suppressChanged)
        return;
    // theme.css changes get their own event so the renderer can reload
    // design tokens without a full page re-parse.
    if (basename(changedPath) === 'theme.css') {
        const content = await readIfExists(changedPath);
        if (content !== null && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC.ThemeChanged, content);
        }
        return;
    }
    const ext = extname(changedPath);
    const isTsx = ext === '.tsx';
    const isCss = changedPath.endsWith('.module.css');
    if (!isTsx && !isCss)
        return;
    // Resolve sibling file so the renderer always receives both halves of a page.
    const dir = dirname(changedPath);
    const base = basename(changedPath).replace(/\.tsx$|\.module\.css$/, '');
    const tsxPath = join(dir, `${base}.tsx`);
    const cssPath = join(dir, `${base}.module.css`);
    const tsxContent = await readIfExists(tsxPath);
    const cssContent = await readIfExists(cssPath);
    // Window may have been destroyed during the async reads above.
    if (mainWindow.isDestroyed())
        return;
    const payload = {
        path: changedPath,
        tsxContent,
        cssContent,
    };
    mainWindow.webContents.send(IPC.FileChanged, payload);
};
const readIfExists = async (p) => {
    try {
        return await fs.readFile(p, 'utf-8');
    }
    catch {
        return null;
    }
};
export const getWatchedPath = () => watchedPath;
