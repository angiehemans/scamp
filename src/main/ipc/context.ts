import { ipcMain } from 'electron';

import { IPC } from '@shared/ipcChannels';
import type { ContextWriteArgs } from '@shared/types';

import { writeContextFile } from './contextOps';

export const registerContextIpc = (): void => {
  ipcMain.handle(IPC.ContextWrite, async (_e, args: ContextWriteArgs) => {
    await writeContextFile(args);
  });
};
