import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  PageCreateArgs,
  PageDeleteArgs,
  PageDuplicateArgs,
  PageRenameArgs,
} from '@shared/types';
import { suppressNextChange } from '../watcher';
import { renamePageFiles } from './pageRename';
import { getProjectFormat } from './projectFormatCache';
import { createPage, deletePage, duplicatePage } from './pageOps';

export const registerPageIpc = (): void => {
  ipcMain.handle(IPC.PageCreate, async (_e, args: PageCreateArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return createPage(args, format);
  });
  ipcMain.handle(IPC.PageDelete, async (_e, args: PageDeleteArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return deletePage(args, format);
  });
  ipcMain.handle(IPC.PageDuplicate, async (_e, args: PageDuplicateArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return duplicatePage(args, format);
  });
  ipcMain.handle(IPC.PageRename, async (_e, args: PageRenameArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return renamePageFiles(args, format, suppressNextChange);
  });
};
