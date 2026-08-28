import { ipcMain } from 'electron';

import { IPC } from '@shared/ipcChannels';
import type {
  ProjectReadThumbnailArgs,
  ProjectWriteThumbnailArgs,
} from '@shared/types';

import {
  readProjectThumbnail,
  writeProjectThumbnail,
} from './projectThumbnailOps';

/**
 * Read/write the start-screen project thumbnail.
 *
 * Unlike the component equivalent these are not gated on project format
 * or on the active project: the start screen reads thumbnails for projects
 * that are not open, which is the whole point of them.
 *
 * see docs/notes/project-thumbnails.md
 */
export const registerProjectThumbnailIpc = (): void => {
  ipcMain.handle(
    IPC.ProjectWriteThumbnail,
    async (_e, args: ProjectWriteThumbnailArgs) => writeProjectThumbnail(args)
  );

  ipcMain.handle(
    IPC.ProjectReadThumbnail,
    async (_e, args: ProjectReadThumbnailArgs) => readProjectThumbnail(args)
  );
};
