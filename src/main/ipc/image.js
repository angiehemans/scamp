import { BrowserWindow, dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { IPC } from '@shared/ipcChannels';
import { basename, join } from 'path';
import { copyImage, assetsDirFor, finishDeferredImport } from './imageOps';
import { getProjectFormat } from './projectFormatCache';
import { assertInsideActiveProject } from './pathContainment';
import { suppressNextChange } from '../watcher';
const IMAGE_FILTERS = [
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] },
];
/**
 * Open a native file dialog filtered to image formats.
 * Optionally starts in `defaultPath` (e.g. the project's assets folder).
 */
const chooseImage = async (args) => {
    // Ensure the target directory exists before opening the dialog —
    // Electron silently ignores a defaultPath that doesn't exist.
    if (args?.defaultPath) {
        await fs.mkdir(args.defaultPath, { recursive: true });
    }
    // On Linux (GTK), defaultPath must end with a path separator to be
    // treated as a directory. Without it, GTK interprets the last segment
    // as a filename filter/prefix and opens the parent directory instead.
    let resolvedDefault = args?.defaultPath;
    if (resolvedDefault && !resolvedDefault.endsWith('/') && !resolvedDefault.endsWith('\\')) {
        resolvedDefault += '/';
    }
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: IMAGE_FILTERS,
        defaultPath: resolvedDefault,
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, path: null };
    }
    return { canceled: false, path: result.filePaths[0] };
};
const findWindow = () => BrowserWindow.getAllWindows()[0] ?? null;
/**
 * Convert a deferred import and tell the renderer to switch to the
 * result.
 *
 * The original is only deleted once the renderer confirms something
 * actually moved to the new file — deleting on a guess would leave a
 * broken image in the user's project. No confirmation (window closed,
 * user navigated away) means both files stay: wasteful, never broken.
 */
const runDeferredOptimization = async (projectPath, copied, format) => {
    let optimized = null;
    try {
        optimized = await finishDeferredImport(projectPath, copied.fileName, format);
    }
    catch {
        optimized = null;
    }
    if (!optimized)
        return;
    suppressNextChange(join(assetsDirFor(projectPath, format), optimized.fileName));
    const win = findWindow();
    if (!win || win.isDestroyed())
        return;
    const payload = {
        from: copied.relativePath,
        to: optimized.relativePath,
    };
    win.webContents.send(IPC.ImageOptimized, payload);
};
export const registerImageIpc = () => {
    // The renderer reports whether the swap landed; only then is the
    // now-unreferenced file removed.
    ipcMain.handle(IPC.ImageOptimizedApplied, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        const format = await getProjectFormat(args.projectPath);
        const assetsDir = assetsDirFor(args.projectPath, format);
        const loser = args.applied ? args.from : args.to;
        const target = join(assetsDir, basename(loser));
        try {
            assertInsideActiveProject(target);
            suppressNextChange(target);
            await fs.unlink(target);
        }
        catch {
            // Already gone, or outside the project — nothing to clean up.
        }
    });
    ipcMain.handle(IPC.FileCopyImage, async (_e, args) => {
        // The copy destination is derived from `projectPath`; keep it inside
        // the active project. `sourcePath` is a user-chosen file (native
        // dialog) and may legitimately live anywhere, so it isn't contained.
        assertInsideActiveProject(args.projectPath);
        const format = await getProjectFormat(args.projectPath);
        // Deferred: the original is copied now and converted in the
        // background, so a large photo appears on the canvas immediately
        // instead of after several seconds of encoding.
        // see docs/plans/image-import-speed-plan.md
        const result = await copyImage(args, format, true);
        // Suppress the watcher event for our own asset write so importing an
        // SVG doesn't immediately fire a "changed externally" reload prompt.
        // Only when we actually wrote: a suppression with no write to match
        // stays armed and swallows the next REAL edit to that file instead.
        if (!result.reused) {
            suppressNextChange(join(assetsDirFor(args.projectPath, format), result.fileName));
        }
        if (result.pendingOptimization) {
            // Deliberately not awaited: the handler answers now, the encode
            // finishes later and announces itself.
            void runDeferredOptimization(args.projectPath, result, format);
        }
        return result;
    });
    ipcMain.handle(IPC.FileChooseImage, async (_e, args) => chooseImage(args));
    // Read a file's UTF-8 text. Used to inline an imported `.svg` (the path
    // comes from the native picker) and to reload an SVG whose asset file
    // changed on disk. Only `.svg` files are readable through this channel —
    // it isn't a general filesystem escape hatch.
    ipcMain.handle(IPC.FileReadText, async (_e, filePath) => {
        if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.svg')) {
            throw new Error('FileReadText: only .svg files may be read');
        }
        return fs.readFile(filePath, 'utf-8');
    });
};
