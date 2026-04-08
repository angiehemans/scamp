import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { RecentProject } from '@shared/types';

const MAX_RECENT = 5;

const storePath = (): string => join(app.getPath('userData'), 'recentProjects.json');

const readStore = async (): Promise<RecentProject[]> => {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'recentProjects' in parsed) {
      const list = (parsed as { recentProjects: unknown }).recentProjects;
      if (Array.isArray(list)) return list as RecentProject[];
    }
    return [];
  } catch {
    return [];
  }
};

const writeStore = async (list: RecentProject[]): Promise<void> => {
  await fs.writeFile(
    storePath(),
    JSON.stringify({ recentProjects: list }, null, 2),
    'utf-8'
  );
};

export const addRecentProject = async (project: { name: string; path: string }): Promise<void> => {
  const list = await readStore();
  const filtered = list.filter((p) => p.path !== project.path);
  const next: RecentProject[] = [
    { name: project.name, path: project.path, lastOpened: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_RECENT);
  await writeStore(next);
};

const getWithExistence = async (): Promise<Array<RecentProject & { exists: boolean }>> => {
  const list = await readStore();
  const checked = await Promise.all(
    list.map(async (p) => {
      try {
        const stat = await fs.stat(p.path);
        return { ...p, exists: stat.isDirectory() };
      } catch {
        return { ...p, exists: false };
      }
    })
  );
  return checked;
};

const removeRecentProject = async (path: string): Promise<void> => {
  const list = await readStore();
  await writeStore(list.filter((p) => p.path !== path));
};

export const registerRecentProjectsIpc = (): void => {
  ipcMain.handle(IPC.RecentProjectsGet, () => getWithExistence());
  ipcMain.handle(IPC.RecentProjectsRemove, (_e, args: { path: string }) =>
    removeRecentProject(args.path)
  );
};
