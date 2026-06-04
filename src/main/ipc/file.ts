import { ipcMain } from 'electron';
import { randomBytes, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, basename, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type {
  FilePatchArgs,
  FilePatchResult,
  FileWriteArgs,
  FileWriteResult,
} from '@shared/types';
import { patchClassBlock } from '@shared/patchClass';
import { cancelPendingWrite, registerPendingWrite } from '../watcher';
import { checkWriteConflict } from './fileConflict';

const RENAME_RACE_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

// see docs/notes/windows-rename-race.md
const renameWithRetry = async (from: string, to: string): Promise<void> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      if (!RENAME_RACE_CODES.has(code)) throw err;
      await new Promise((r) => setTimeout(r, 20 + attempt * 30));
    }
  }
  await fs.rename(from, to);
};

/**
 * Atomic write: write to a sibling .tmp file then rename. Prevents readers
 * (chokidar / external editors) from seeing a half-written file.
 *
 * Each write uses a unique tmp filename so concurrent writes to the same
 * target don't collide (one rename consuming the other's tmp → ENOENT).
 */
const atomicWrite = async (path: string, content: string): Promise<void> => {
  const suffix = randomBytes(4).toString('hex');
  const tmp = join(dirname(path), `.${basename(path)}.${suffix}.tmp`);
  await fs.writeFile(tmp, content, 'utf-8');
  await renameWithRetry(tmp, path);
};

const handleWrite = async (args: FileWriteArgs): Promise<FileWriteResult> => {
  const conflict = await checkWriteConflict(args);
  if (conflict) {
    return { ok: false, conflict };
  }

  const writeId = randomUUID();
  // Page writes suppress `file:changed` — the renderer generated the
  // content itself and re-parsing it would just cause flicker. The
  // ack still fires so the save-status indicator can transition.
  registerPendingWrite(args.tsxPath, writeId, true);
  registerPendingWrite(args.cssPath, writeId, true);
  try {
    await atomicWrite(args.tsxPath, args.tsxContent);
    await atomicWrite(args.cssPath, args.cssContent);
  } catch (err) {
    cancelPendingWrite(args.tsxPath);
    cancelPendingWrite(args.cssPath);
    throw err;
  }
  return { ok: true, writeId };
};

/**
 * Patch a single class block in a CSS module file via postcss. The rest
 * of the file is left untouched.
 *
 * Unlike `handleWrite`, we let the `file:changed` broadcast fire — the
 * properties panel relies on the resulting round-trip through
 * `parseCode` to refresh the canvas. The ack is additive: it only
 * drives the save-status indicator.
 */
const handlePatch = async (args: FilePatchArgs): Promise<FilePatchResult> => {
  const writeId = randomUUID();
  registerPendingWrite(args.cssPath, writeId, false);
  try {
    const original = await fs.readFile(args.cssPath, 'utf-8');
    const next = patchClassBlock(
      original,
      args.className,
      args.newDeclarations,
      args.media
    );
    await atomicWrite(args.cssPath, next);
  } catch (err) {
    cancelPendingWrite(args.cssPath);
    throw err;
  }
  return { writeId };
};

export const registerFileIpc = (): void => {
  ipcMain.handle(IPC.FileWrite, (_e, args: FileWriteArgs) => handleWrite(args));
  ipcMain.handle(IPC.FilePatch, (_e, args: FilePatchArgs) => handlePatch(args));
};
