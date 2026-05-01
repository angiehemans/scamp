import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import { normalizeRecentProjectEntry } from '@shared/recentProjectNormalize';
const MAX_RECENT = 5;
const storePath = () => join(app.getPath('userData'), 'recentProjects.json');
const readStore = async () => {
    try {
        const raw = await fs.readFile(storePath(), 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'recentProjects' in parsed) {
            const list = parsed.recentProjects;
            if (Array.isArray(list)) {
                return list
                    .map(normalizeRecentProjectEntry)
                    .filter((e) => e !== null);
            }
        }
        return [];
    }
    catch {
        return [];
    }
};
const writeStore = async (list) => {
    await fs.writeFile(storePath(), JSON.stringify({ recentProjects: list }, null, 2), 'utf-8');
};
export const addRecentProject = async (project) => {
    const list = await readStore();
    const filtered = list.filter((p) => p.path !== project.path);
    const next = [
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
export const updateRecentProjectFormat = async (path, format) => {
    const list = await readStore();
    const next = list.map((p) => p.path === path ? { ...p, format } : p);
    await writeStore(next);
};
const getWithExistence = async () => {
    const list = await readStore();
    const checked = await Promise.all(list.map(async (p) => {
        try {
            const stat = await fs.stat(p.path);
            return { ...p, exists: stat.isDirectory() };
        }
        catch {
            return { ...p, exists: false };
        }
    }));
    return checked;
};
const removeRecentProject = async (path) => {
    const list = await readStore();
    await writeStore(list.filter((p) => p.path !== path));
};
export const registerRecentProjectsIpc = () => {
    ipcMain.handle(IPC.RecentProjectsGet, () => getWithExistence());
    ipcMain.handle(IPC.RecentProjectsRemove, (_e, args) => removeRecentProject(args.path));
};
