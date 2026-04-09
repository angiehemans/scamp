import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { Settings } from '@shared/types';

/**
 * Persistent app-level settings stored next to the recent projects list in
 * Electron's userData directory. Right now this is only the default
 * projects folder; the file format is a JSON object so we can grow it
 * without a migration.
 */

const storePath = (): string => join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS: Settings = {
  defaultProjectsFolder: null,
  artboardBackground: '#0f0f0f',
};

const readStore = async (): Promise<Settings> => {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const obj = parsed as Record<string, unknown>;
    const folder = obj['defaultProjectsFolder'];
    const artboard = obj['artboardBackground'];
    // Migrate: old `canvasBackground` key mapped to the same concept.
    const legacy = obj['canvasBackground'];
    const artboardValue = typeof artboard === 'string'
      ? artboard
      : typeof legacy === 'string'
        ? legacy
        : DEFAULT_SETTINGS.artboardBackground;
    return {
      defaultProjectsFolder: typeof folder === 'string' ? folder : null,
      artboardBackground: artboardValue,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

const writeStore = async (settings: Settings): Promise<void> => {
  const path = storePath();
  // Make sure the userData directory exists. Electron normally creates it
  // on startup, but on a fresh install the very first write can land
  // before any other code has touched the directory, and fs.writeFile
  // does not create parent dirs.
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(settings, null, 2), 'utf-8');
};

const getSettings = async (): Promise<Settings> => readStore();

const setDefaultFolder = async (path: string | null): Promise<Settings> => {
  const current = await readStore();
  const next: Settings = { ...current, defaultProjectsFolder: path };
  await writeStore(next);
  return next;
};

const updateSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const current = await readStore();
  const next: Settings = { ...current, ...patch };
  await writeStore(next);
  return next;
};

export const registerSettingsIpc = (): void => {
  ipcMain.handle(IPC.SettingsGet, async () => {
    try {
      return await getSettings();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[settings:get] failed', e);
      throw e;
    }
  });
  ipcMain.handle(IPC.SettingsSetDefaultFolder, async (_e, args: { path: string | null }) => {
    try {
      return await setDefaultFolder(args.path);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[settings:setDefaultFolder] failed', e);
      throw e;
    }
  });
  ipcMain.handle(IPC.SettingsUpdate, async (_e, patch: Partial<Settings>) => {
    try {
      return await updateSettings(patch);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[settings:update] failed', e);
      throw e;
    }
  });
};

export { getSettings };
