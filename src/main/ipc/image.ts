import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { IPC } from '@shared/ipcChannels';
import type {
  ChooseImageArgs,
  CopyImageArgs,
  CopyImageResult,
  ChooseImageResult,
} from '@shared/types';
import { join } from 'path';
import { copyImage, assetsDirFor } from './imageOps';
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
const chooseImage = async (args?: ChooseImageArgs): Promise<ChooseImageResult> => {
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
  return { canceled: false, path: result.filePaths[0]! };
};

export const registerImageIpc = (): void => {
  ipcMain.handle(
    IPC.FileCopyImage,
    async (_e, args: CopyImageArgs): Promise<CopyImageResult> => {
      // The copy destination is derived from `projectPath`; keep it inside
      // the active project. `sourcePath` is a user-chosen file (native
      // dialog) and may legitimately live anywhere, so it isn't contained.
      assertInsideActiveProject(args.projectPath);
      const format = await getProjectFormat(args.projectPath);
      const result = await copyImage(args, format);
      // Suppress the watcher event for our own asset write so importing an
      // SVG doesn't immediately fire a "changed externally" reload prompt.
      suppressNextChange(join(assetsDirFor(args.projectPath, format), result.fileName));
      return result;
    }
  );
  ipcMain.handle(IPC.FileChooseImage, async (_e, args?: ChooseImageArgs) => chooseImage(args));
  // Read a file's UTF-8 text. Used to inline an imported `.svg` (the path
  // comes from the native picker) and to reload an SVG whose asset file
  // changed on disk. Only `.svg` files are readable through this channel —
  // it isn't a general filesystem escape hatch.
  ipcMain.handle(IPC.FileReadText, async (_e, filePath: string): Promise<string> => {
    if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.svg')) {
      throw new Error('FileReadText: only .svg files may be read');
    }
    return fs.readFile(filePath, 'utf-8');
  });
};
