import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import { getProjectFormat } from './projectFormatCache';
/**
 * Path on disk where a project's `theme.css` lives. Nextjs projects
 * co-locate it inside `app/` so the root layout can import it and
 * `next dev` picks up the tokens; legacy keeps it at the project root.
 */
const themePathFor = (projectPath, format) => format === 'nextjs'
    ? join(projectPath, 'app', 'theme.css')
    : join(projectPath, 'theme.css');
/**
 * Read the project's theme.css. Returns the file content as a string,
 * or an empty string if the file doesn't exist.
 */
const readTheme = async (projectPath) => {
    const format = await getProjectFormat(projectPath);
    try {
        return await fs.readFile(themePathFor(projectPath, format), 'utf-8');
    }
    catch {
        return '';
    }
};
/**
 * Write the project's theme.css, replacing its entire content.
 */
const writeTheme = async (args) => {
    const format = await getProjectFormat(args.projectPath);
    await fs.writeFile(themePathFor(args.projectPath, format), args.content, 'utf-8');
};
export const registerThemeIpc = () => {
    ipcMain.handle(IPC.ThemeRead, async (_e, args) => readTheme(args.projectPath));
    ipcMain.handle(IPC.ThemeWrite, async (_e, args) => writeTheme(args));
};
