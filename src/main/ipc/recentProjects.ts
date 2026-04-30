import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import { normalizeRecentProjectEntry } from '@shared/recentProjectNormalize';
import type { ProjectFormat, RecentProject } from '@shared/types';

const MAX_RECENT = 5;

const storePath = (): string => join(app.getPath('userData'), 'recentProjects.json');

const readStore = async (): Promise<RecentProject[]> => {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'recentProjects' in parsed) {
      const list = (parsed as { recentProjects: unknown }).recentProjects;
      if (Array.isArray(list)) {
        return list
          .map(normalizeRecentProjectEntry)
          .filter((e): e is RecentProject => e !== null);
      }
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

export const addRecentProject = async (project: {
  name: string;
  path: string;
  format: ProjectFormat;
}): Promise<void> => {
  const list = await readStore();
  const filtered = list.filter((p) => p.path !== project.path);
  const next: RecentProject[] = [
    {
      name: project.name,
      path: project.path,
      format: project.format,
      lastOpened: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, MAX_RECENT);
  await writeStore(next);
};

/**
 * Update the format of a recent-projects entry in place. Called after
 * a successful legacy → nextjs migration so the next open sees the
 * correct format without a re-detect.
 */
export const updateRecentProjectFormat = async (
  path: string,
  format: ProjectFormat
): Promise<void> => {
  const list = await readStore();
  const next = list.map((p) =>
    p.path === path ? { ...p, format } : p
  );
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
