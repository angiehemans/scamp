import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { IPC } from '@shared/ipcChannels';
import type {
  ExportChooseSavePathArgs,
  ExportChooseSavePathResult,
  ExportFormat,
  ExportPngArgs,
  ExportResult,
  ExportSvgArgs,
} from '@shared/types';

const EXTENSION_FOR: Record<ExportFormat, string> = {
  png: 'png',
  svg: 'svg',
};

const FILTER_FOR: Record<ExportFormat, Electron.FileFilter> = {
  png: { name: 'PNG image', extensions: ['png'] },
  svg: { name: 'SVG image', extensions: ['svg'] },
};

/**
 * Show a native save dialog and return the chosen path. The handler
 * pre-creates the default directory if it doesn't exist (matches the
 * behaviour of the image-chooser handler — Electron silently ignores
 * `defaultPath` that doesn't resolve).
 */
const chooseSavePath = async (
  args: ExportChooseSavePathArgs
): Promise<ExportChooseSavePathResult> => {
  const ext = EXTENSION_FOR[args.format];
  const filter = FILTER_FOR[args.format];

  let defaultDir = args.defaultDir;
  if (defaultDir) {
    try {
      await fs.mkdir(defaultDir, { recursive: true });
    } catch {
      // If we can't create the dir, fall back to the user's home — the
      // dialog will still open, just at a default location.
      defaultDir = undefined;
    }
  }

  const sanitized = sanitizeFilename(args.filename) || 'export';
  const defaultPath = defaultDir
    ? path.join(defaultDir, `${sanitized}.${ext}`)
    : `${sanitized}.${ext}`;

  const result = await dialog.showSaveDialog({
    title: 'Export',
    defaultPath,
    filters: [filter],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true, path: null };
  }
  return { canceled: false, path: result.filePath };
};

/** Strip path separators and other characters that don't belong in a filename. */
const sanitizeFilename = (raw: string): string =>
  raw.replace(/[\\/:*?"<>|]+/g, '').trim();

/** Decode a `data:image/png;base64,…` URL into a buffer. */
const decodeDataUrl = (dataUrl: string): Buffer => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Malformed data URL');
  const base64 = dataUrl.slice(comma + 1);
  return Buffer.from(base64, 'base64');
};

const writePng = async (args: ExportPngArgs): Promise<ExportResult> => {
  try {
    const buf = decodeDataUrl(args.dataUrl);
    await fs.writeFile(args.path, buf);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to write PNG.',
    };
  }
};

const writeSvg = async (args: ExportSvgArgs): Promise<ExportResult> => {
  try {
    await fs.writeFile(args.path, args.svgString, 'utf-8');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to write SVG.',
    };
  }
};

export const registerExportIpc = (): void => {
  ipcMain.handle(
    IPC.ExportChooseSavePath,
    async (_e, args: ExportChooseSavePathArgs) => chooseSavePath(args)
  );
  ipcMain.handle(
    IPC.ExportPng,
    async (_e, args: ExportPngArgs) => writePng(args)
  );
  ipcMain.handle(
    IPC.ExportSvg,
    async (_e, args: ExportSvgArgs) => writeSvg(args)
  );
};
