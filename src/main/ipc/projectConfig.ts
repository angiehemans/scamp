import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  ProjectConfigReadArgs,
  ProjectConfigWriteArgs,
} from '@shared/types';
import { readConfig, writeConfig, ensureProjectConfig } from './projectConfigOps';
import { assertInsideActiveProject } from './pathContainment';

// Re-exported for project create/open, which backfill the config file.
export { ensureProjectConfig };

export const registerProjectConfigIpc = (): void => {
  ipcMain.handle(
    IPC.ProjectConfigRead,
    async (_e, args: ProjectConfigReadArgs) => {
      assertInsideActiveProject(args.projectPath);
      return readConfig(args.projectPath);
    }
  );
  ipcMain.handle(
    IPC.ProjectConfigWrite,
    async (_e, args: ProjectConfigWriteArgs) => {
      assertInsideActiveProject(args.projectPath);
      return writeConfig(args.projectPath, args.config);
    }
  );
};
