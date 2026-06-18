import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import { parseRecentStore, upsertRecent, setRecentFormat, removeRecentByPath, } from './recentProjectsOps';
const storePath = () => join(app.getPath('userData'), 'recentProjects.json');
const readStore = async () => {
    try {
        return parseRecentStore(await fs.readFile(storePath(), 'utf-8'));
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
    await writeStore(upsertRecent(list, {
        name: project.name,
        path: project.path,
        format: project.format,
        lastOpened: new Date().toISOString(),
    }));
};
/**
 * Update the format of a recent-projects entry in place. Called after
 * a successful legacy → nextjs migration so the next open sees the
 * correct format without a re-detect.
 */
export const updateRecentProjectFormat = async (path, format) => {
    await writeStore(setRecentFormat(await readStore(), path, format));
};
const getWithExistence = async () => {
    const list = await readStore();
    return Promise.all(list.map(async (p) => {
        try {
            const stat = await fs.stat(p.path);
            return { ...p, exists: stat.isDirectory() };
        }
        catch {
            return { ...p, exists: false };
        }
    }));
};
const removeRecentProject = async (path) => {
    await writeStore(removeRecentByPath(await readStore(), path));
};
export const registerRecentProjectsIpc = () => {
    ipcMain.handle(IPC.RecentProjectsGet, () => getWithExistence());
    ipcMain.handle(IPC.RecentProjectsRemove, (_e, args) => removeRecentProject(args.path));
};
