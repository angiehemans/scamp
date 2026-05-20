import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  ComponentCreateArgs,
  ComponentDeleteArgs,
  ComponentReadArgs,
  ComponentReadThumbnailArgs,
  ComponentWriteThumbnailArgs,
} from '@shared/types';
import { getProjectFormat } from './projectFormatCache';
import {
  createComponent,
  deleteComponent,
  readComponent,
  readComponentThumbnail,
  writeComponentThumbnail,
} from './componentOps';

/**
 * Wire up the Phase 1 component IPC channels. Mirror of
 * `registerPageIpc` — every handler resolves the project format
 * from the cached lookup before delegating, so callers don't
 * have to pass it explicitly.
 *
 * Rename / lockProp / renameProp / createFromElement land in
 * later phases (see `docs/plans/2026-05-17-components.md`).
 */
export const registerComponentIpc = (): void => {
  ipcMain.handle(IPC.ComponentCreate, async (_e, args: ComponentCreateArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return createComponent(args, format);
  });
  ipcMain.handle(IPC.ComponentDelete, async (_e, args: ComponentDeleteArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return deleteComponent(args, format);
  });
  ipcMain.handle(IPC.ComponentRead, async (_e, args: ComponentReadArgs) => {
    const format = await getProjectFormat(args.projectPath);
    return readComponent(args, format);
  });
  ipcMain.handle(
    IPC.ComponentWriteThumbnail,
    async (_e, args: ComponentWriteThumbnailArgs) => {
      const format = await getProjectFormat(args.projectPath);
      return writeComponentThumbnail(args, format);
    }
  );
  ipcMain.handle(
    IPC.ComponentReadThumbnail,
    async (_e, args: ComponentReadThumbnailArgs) => {
      const format = await getProjectFormat(args.projectPath);
      return readComponentThumbnail(args, format);
    }
  );
};
