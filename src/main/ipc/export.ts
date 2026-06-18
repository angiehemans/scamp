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
import { EXTENSION_FOR, sanitizeFilename, decodeDataUrl } from './exportOps';

/**
 * Paths the user has approved this session via the native save dialog.
 * Export writes go to an arbitrary user-chosen location (Desktop, etc.),
 * so project containment doesn't apply — instead the dialog is the trust
 * boundary, and `writePng` / `writeSvg` only accept a path that came back
 * from `chooseSavePath`. Blocks a compromised renderer from writing
 * arbitrary files (e.g. overwriting `~/.bashrc`) by calling the export
 * IPC directly with a forged path.
 */
const dialogApprovedPaths = new Set<string>();

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
  dialogApprovedPaths.add(path.resolve(result.filePath));
  return { canceled: false, path: result.filePath };
};

/**
 * Reject an export write whose path the user didn't approve via the save
 * dialog this session. Throws so the IPC rejects and the caller surfaces
 * the failure.
 */
const assertDialogApproved = (filePath: string): void => {
  if (!dialogApprovedPaths.has(path.resolve(filePath))) {
    throw new Error('Export path was not approved via the save dialog.');
  }
};

const writePng = async (args: ExportPngArgs): Promise<ExportResult> => {
  try {
    assertDialogApproved(args.path);
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
    assertDialogApproved(args.path);
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
