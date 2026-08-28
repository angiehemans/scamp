import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { readProjectThumbnail, writeProjectThumbnail, } from './projectThumbnailOps';
/**
 * Read/write the start-screen project thumbnail.
 *
 * Unlike the component equivalent these are not gated on project format
 * or on the active project: the start screen reads thumbnails for projects
 * that are not open, which is the whole point of them.
 *
 * see docs/notes/project-thumbnails.md
 */
export const registerProjectThumbnailIpc = () => {
    ipcMain.handle(IPC.ProjectWriteThumbnail, async (_e, args) => writeProjectThumbnail(args));
    ipcMain.handle(IPC.ProjectReadThumbnail, async (_e, args) => readProjectThumbnail(args));
};
