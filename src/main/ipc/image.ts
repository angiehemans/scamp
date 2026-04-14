import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { ChooseImageArgs, CopyImageArgs, CopyImageResult, ChooseImageResult } from '@shared/types';

const IMAGE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] },
];

/**
 * Copy an image file into the project's `assets/` folder. Creates the
 * folder if it doesn't exist. Deduplicates filenames by appending a
 * numeric suffix when a name collision occurs.
 */
const copyImage = async (args: CopyImageArgs): Promise<CopyImageResult> => {
  const assetsDir = join(args.projectPath, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const ext = extname(args.sourcePath);
  const base = basename(args.sourcePath, ext);
  let fileName = `${base}${ext}`;
  let destPath = join(assetsDir, fileName);

  // Deduplicate: hero.png → hero-1.png → hero-2.png
  let counter = 1;
  while (true) {
    try {
      await fs.access(destPath);
      fileName = `${base}-${counter}${ext}`;
      destPath = join(assetsDir, fileName);
      counter += 1;
    } catch {
      break; // File doesn't exist — safe to use this name.
    }
  }

  await fs.copyFile(args.sourcePath, destPath);
  return {
    relativePath: `./assets/${fileName}`,
    fileName,
  };
};

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
  ipcMain.handle(IPC.FileCopyImage, async (_e, args: CopyImageArgs) => copyImage(args));
  ipcMain.handle(IPC.FileChooseImage, async (_e, args?: ChooseImageArgs) => chooseImage(args));
};
