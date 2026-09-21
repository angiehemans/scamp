import { ipcMain, shell } from 'electron';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type {
  DevVarsReadArgs,
  DevVarsReadResult,
  RouteFile,
  RouteReadArgs,
  RouteSetRenderArgs,
  RouteRenameViewArgs,
  RouteWriteArgs,
  RoutesListArgs,
} from '@shared/types';
import {
  listRoutes,
  readDevVarsKeys,
  readRouteFile,
  renameRouteForView,
  setRouteRender,
  writeRouteFile,
} from './routeOps';

/** Register the routes IPC: listing, reading, the render export, generation, and `.dev.vars` keys. */
export const registerRoutesIpc = (): void => {
  ipcMain.handle(IPC.RoutesList, (_e, args: RoutesListArgs): Promise<RouteFile[]> =>
    listRoutes(args.projectPath)
  );
  ipcMain.handle(IPC.RoutesRead, (_e, args: RouteReadArgs): Promise<string> =>
    readRouteFile(args.projectPath, args.file)
  );
  ipcMain.handle(IPC.RoutesSetRender, (_e, args: RouteSetRenderArgs): Promise<void> =>
    setRouteRender(args.projectPath, args.file, args.render)
  );
  ipcMain.handle(IPC.RoutesWrite, (_e, args: RouteWriteArgs): Promise<void> =>
    writeRouteFile(args.projectPath, args.file, args.content)
  );
  ipcMain.handle(IPC.RoutesRenameView, (_e, args: RouteRenameViewArgs): Promise<string | null> =>
    renameRouteForView(args.projectPath, args.oldView, args.newView)
  );
  ipcMain.handle(IPC.DevVarsRead, (_e, args: DevVarsReadArgs): Promise<DevVarsReadResult> =>
    readDevVarsKeys(args.projectPath)
  );
  // Open `.dev.vars` in the user's editor; the app never shows its values.
  ipcMain.handle(IPC.DevVarsOpen, async (_e, args: DevVarsReadArgs): Promise<void> => {
    await shell.openPath(join(args.projectPath, '.dev.vars'));
  });
};
