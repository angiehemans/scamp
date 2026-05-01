import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  PreviewGetStatusArgs,
  PreviewOpenArgs,
  PreviewRestartArgs,
  PreviewStopArgs,
} from '@shared/types';
import {
  ensureDevServer,
  getDevServerStatus,
  restartDevServer,
  stopDevServer,
} from '../devServer/devServerManager';

type PreviewWindowApi = {
  open: (projectPath: string, pageName: string) => Promise<{ id: number }>;
  close: (projectPath: string) => void;
};

/**
 * Register the IPC handlers preview mode needs. Idempotent — safe
 * to call once at app startup.
 *
 * The window functions are injected so this module doesn't pull in
 * the BrowserWindow code path directly.
 */
export const registerPreviewIpc = (windowApi: PreviewWindowApi): void => {
  ipcMain.handle(IPC.PreviewOpen, async (_e, args: PreviewOpenArgs) => {
    // Open (or reuse) the window for this project. The window's
    // renderer will subscribe to status changes via the IPC channel
    // PreviewStatusChanged; we kick the dev server in parallel so
    // the install / start work begins as soon as possible.
    const win = await windowApi.open(args.projectPath, args.pageName);
    void ensureDevServer(args.projectPath);
    return { windowId: win.id };
  });

  ipcMain.handle(IPC.PreviewStop, async (_e, args: PreviewStopArgs) => {
    await stopDevServer(args.projectPath);
  });

  /**
   * Close the preview window AND stop the dev server for a project.
   * Used by the renderer when the user closes the project itself —
   * we don't want the server outliving the project that's editing it.
   */
  ipcMain.handle(IPC.PreviewClose, async (_e, args: PreviewStopArgs) => {
    windowApi.close(args.projectPath);
    await stopDevServer(args.projectPath);
  });

  ipcMain.handle(IPC.PreviewRestart, async (_e, args: PreviewRestartArgs) => {
    await restartDevServer(args.projectPath);
  });

  ipcMain.handle(IPC.PreviewGetStatus, (_e, args: PreviewGetStatusArgs) => {
    return getDevServerStatus(args.projectPath);
  });
};
