import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { assertInsideActiveProject } from './pathContainment';
import { readDesignMdFile, writeDesignMdFile } from './designMdOps';
export const registerDesignMdIpc = () => {
    ipcMain.handle(IPC.DesignMdRead, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        return readDesignMdFile(args.projectPath);
    });
    ipcMain.handle(IPC.DesignMdWrite, async (_e, args) => {
        assertInsideActiveProject(args.projectPath);
        return writeDesignMdFile(args.projectPath, args.content);
    });
};
