import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { getProjectFormat } from './projectFormatCache';
import { assertInsideActiveProject } from './pathContainment';
import { readThemeFile, writeThemeFile } from './themeOps';
export const registerThemeIpc = () => {
    ipcMain.handle(IPC.ThemeRead, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        const format = await getProjectFormat(args.projectPath);
        return readThemeFile(args.projectPath, format);
    });
    ipcMain.handle(IPC.ThemeWrite, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        const format = await getProjectFormat(args.projectPath);
        return writeThemeFile(args.projectPath, format, args.content);
    });
};
