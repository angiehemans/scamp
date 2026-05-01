import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { IPC } from '@shared/ipcChannels';
import { copyImage } from './imageOps';
import { getProjectFormat } from './projectFormatCache';
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
export const registerImageIpc = () => {
    ipcMain.handle(IPC.FileCopyImage, async (_e, args) => {
        const format = await getProjectFormat(args.projectPath);
        return copyImage(args, format);
    });
    ipcMain.handle(IPC.FileChooseImage, async (_e, args) => chooseImage(args));
};
