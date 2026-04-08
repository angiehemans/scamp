import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { dirname, basename, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { FilePatchArgs, FileWriteArgs } from '@shared/types';
import { patchClassBlock } from '@shared/patchClass';
import { suppressNextChange } from '../watcher';
// suppressNextChange is intentionally only used for handleWrite (canvas → disk).
// handlePatch deliberately lets chokidar fire so the panel round-trip works.

/**
 * Atomic write: write to a sibling .tmp file then rename. Prevents readers
 * (chokidar / external editors) from seeing a half-written file.
 */
const atomicWrite = async (path: string, content: string): Promise<void> => {
  const tmp = join(dirname(path), `.${basename(path)}.tmp`);
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, path);
};

const handleWrite = async (args: FileWriteArgs): Promise<void> => {
  suppressNextChange(args.tsxPath);
  suppressNextChange(args.cssPath);
  await atomicWrite(args.tsxPath, args.tsxContent);
  await atomicWrite(args.cssPath, args.cssContent);
};

/**
 * Patch a single class block in a CSS module file via postcss. The rest
 * of the file is left untouched.
 *
 * Note: unlike `handleWrite`, we deliberately do NOT suppress the chokidar
 * event here. The properties panel relies on the resulting `file:changed`
 * round-tripping through `parseCode` so the canvas state reflects the
 * user's typed CSS — that's the whole point of the panel.
 */
const handlePatch = async (args: FilePatchArgs): Promise<void> => {
  const original = await fs.readFile(args.cssPath, 'utf-8');
  const next = patchClassBlock(original, args.className, args.newDeclarations);
  await atomicWrite(args.cssPath, next);
};

export const registerFileIpc = (): void => {
  ipcMain.handle(IPC.FileWrite, (_e, args: FileWriteArgs) => handleWrite(args));
  ipcMain.handle(IPC.FilePatch, (_e, args: FilePatchArgs) => handlePatch(args));
};
