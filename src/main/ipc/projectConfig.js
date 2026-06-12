import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { readConfig, writeConfig, ensureProjectConfig } from './projectConfigOps';
import { assertInsideActiveProject } from './pathContainment';
// Re-exported for project create/open, which backfill the config file.
export { ensureProjectConfig };
export const registerProjectConfigIpc = () => {
    ipcMain.handle(IPC.ProjectConfigRead, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        return readConfig(args.projectPath);
    });
    ipcMain.handle(IPC.ProjectConfigWrite, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        return writeConfig(args.projectPath, args.config);
    });
};
