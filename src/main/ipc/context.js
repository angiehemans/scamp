import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { writeContextFile } from './contextOps';
export const registerContextIpc = () => {
    ipcMain.handle(IPC.ContextWrite, async (_e, args) => {
        await writeContextFile(args);
    });
};
