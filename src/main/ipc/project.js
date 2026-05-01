import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { IPC } from '@shared/ipcChannels';
import { DEFAULT_THEME_CSS } from '@shared/agentMd';
import { validateProjectName } from '@shared/projectName';
import { addRecentProject, updateRecentProjectFormat, } from './recentProjects';
import { watchProject } from '../watcher';
import { ensureProjectConfig } from './projectConfig';
import { detectProjectFormat } from './projectFormat';
import { setCachedProjectFormat } from './projectFormatCache';
import { readProjectLegacy, readProjectNextjs, refreshLayoutTemplateIfNeeded, scaffoldLegacyProject, scaffoldNextjsProject, themePathFor, } from './projectScaffold';
import { migrateLegacyToNextjs } from './projectMigrate';
export { detectProjectFormat };
export { scaffoldLegacyProject, scaffoldNextjsProject };
const chooseFolder = async () => {
    const result = await dialog.showOpenDialog({
        title: 'Choose project folder',
        properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, path: null };
    }
    return { canceled: false, path: result.filePaths[0] ?? null };
};
const readProject = async (folderPath) => {
    const format = await detectProjectFormat(folderPath);
    setCachedProjectFormat(folderPath, format);
    const pages = format === 'nextjs'
        ? await readProjectNextjs(folderPath)
        : await readProjectLegacy(folderPath);
    return {
        path: folderPath,
        name: basename(folderPath),
        format,
        pages,
    };
};
const createProject = async (args) => {
    // Re-validate the name on the main side — never trust the renderer.
    const result = validateProjectName(args.name);
    if (!result.ok)
        throw new Error(result.error);
    const name = result.value;
    // The parent must exist; we don't auto-create it because that's the
    // user's "default projects folder" and creating it silently would mask
    // a misconfiguration.
    try {
        const stat = await fs.stat(args.parentPath);
        if (!stat.isDirectory()) {
            throw new Error(`Parent path is not a directory: ${args.parentPath}`);
        }
    }
    catch (e) {
        if (e instanceof Error && e.message.startsWith('Parent path is not'))
            throw e;
        throw new Error(`Parent folder does not exist: ${args.parentPath}`);
    }
    const projectPath = join(args.parentPath, name);
    // Refuse to write into a folder that already exists. The user can pick
    // a different name; we never want to silently merge into a stranger's
    // folder.
    try {
        await fs.access(projectPath);
        throw new Error(`A folder named "${name}" already exists at ${args.parentPath}.`);
    }
    catch (e) {
        if (e instanceof Error && e.message.startsWith('A folder named'))
            throw e;
        // ENOENT — proceed
    }
    await fs.mkdir(projectPath, { recursive: false });
    const format = 'nextjs';
    await scaffoldNextjsProject(projectPath, name);
    await ensureProjectConfig(projectPath);
    setCachedProjectFormat(projectPath, format);
    await addRecentProject({ name, path: projectPath, format });
    await watchProject(projectPath);
    return readProject(projectPath);
};
const openProject = async (args) => {
    const project = await readProject(args.folderPath);
    // Ensure older projects get a theme.css if they don't have one.
    // For nextjs the file lives at `app/theme.css` (the `app/` folder
    // exists by virtue of detection having found a `page.tsx` inside it).
    // For legacy it's at the project root.
    const themePath = themePathFor(args.folderPath, project.format);
    try {
        await fs.access(themePath);
    }
    catch {
        await fs
            .writeFile(themePath, DEFAULT_THEME_CSS, 'utf-8')
            .catch(() => undefined);
    }
    // Backfill scamp.config.json with defaults for projects created
    // before per-project settings existed.
    await ensureProjectConfig(args.folderPath);
    // Refresh `app/layout.tsx` to the latest template when the project
    // still uses a known earlier version. User-customised layouts are
    // left alone; a warning logs to the main process so users debugging
    // a blank preview can find the cause.
    if (project.format === 'nextjs') {
        await refreshLayoutTemplateIfNeeded(args.folderPath).catch(() => undefined);
    }
    await addRecentProject({
        name: project.name,
        path: project.path,
        format: project.format,
    });
    await watchProject(args.folderPath);
    return project;
};
const migrateProject = async (args) => {
    // Re-detect to defend against a stale cache (a user may have hand-
    // converted the project on disk between open and migrate).
    const format = await detectProjectFormat(args.projectPath);
    if (format === 'nextjs') {
        throw new Error('This project is already in Next.js format.');
    }
    const result = await migrateLegacyToNextjs(args.projectPath);
    setCachedProjectFormat(args.projectPath, 'nextjs');
    await updateRecentProjectFormat(args.projectPath, 'nextjs');
    // Re-read so the renderer gets the post-migration project data
    // (new page paths, new format, etc.) without a full close/reopen.
    const project = await readProject(args.projectPath);
    return { project, backupPath: result.backupPath };
};
export const registerProjectIpc = () => {
    ipcMain.handle(IPC.ProjectChooseFolder, () => chooseFolder());
    ipcMain.handle(IPC.ProjectCreate, (_e, args) => createProject(args));
    ipcMain.handle(IPC.ProjectOpen, (_e, args) => openProject(args));
    ipcMain.handle(IPC.ProjectRead, (_e, args) => readProject(args.folderPath));
    ipcMain.handle(IPC.ProjectMigrate, (_e, args) => migrateProject(args));
};
