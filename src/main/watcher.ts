import { BrowserWindow } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import { extname, basename, dirname, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { FileChangedPayload } from '@shared/types';

let watcher: FSWatcher | null = null;
let mainWindow: BrowserWindow | null = null;
let watchedPath: string | null = null;

/**
 * Suppression set for paths the renderer just wrote. Prevents the
 * canvas from re-parsing files it produced itself, which would cause flicker.
 * Entries are auto-cleared after a short window.
 */
const suppressed = new Map<string, NodeJS.Timeout>();

const SUPPRESS_MS = 400;

export const initWatcher = (win: BrowserWindow): void => {
  mainWindow = win;
};

export const disposeWatcher = (): void => {
  if (watcher) {
    void watcher.close();
    watcher = null;
  }
  watchedPath = null;
};

export const watchProject = async (folderPath: string): Promise<void> => {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  watchedPath = folderPath;

  watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 1,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
  });

  const handle = (changedPath: string): void => {
    void emitChange(changedPath);
  };

  watcher.on('add', handle);
  watcher.on('change', handle);
};

export const suppressNextChange = (path: string): void => {
  const existing = suppressed.get(path);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    suppressed.delete(path);
  }, SUPPRESS_MS);
  suppressed.set(path, t);
};

const emitChange = async (changedPath: string): Promise<void> => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (suppressed.has(changedPath)) return;

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
  if (!isTsx && !isCss) return;

  // Resolve sibling file so the renderer always receives both halves of a page.
  const dir = dirname(changedPath);
  const base = basename(changedPath).replace(/\.tsx$|\.module\.css$/, '');
  const tsxPath = join(dir, `${base}.tsx`);
  const cssPath = join(dir, `${base}.module.css`);

  const tsxContent = await readIfExists(tsxPath);
  const cssContent = await readIfExists(cssPath);

  // Window may have been destroyed during the async reads above.
  if (mainWindow.isDestroyed()) return;

  const payload: FileChangedPayload = {
    path: changedPath,
    tsxContent,
    cssContent,
  };
  mainWindow.webContents.send(IPC.FileChanged, payload);
};

const readIfExists = async (p: string): Promise<string | null> => {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
};

export const getWatchedPath = (): string | null => watchedPath;
