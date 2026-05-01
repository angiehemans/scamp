import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  DevServerStatus,
  PreviewNavigatePayload,
  PreviewStatusChangedPayload,
} from '@shared/types';

/**
 * Tiny preload for the preview BrowserWindow. The preview's renderer
 * doesn't need the full Scamp API — only the channels for receiving
 * dev-server status updates, navigation requests, and triggering a
 * server restart.
 */
const previewApi = {
  /** Subscribe to status-changed events from main. Returns the
   *  unsubscribe function. */
  onStatusChanged: (
    listener: (payload: PreviewStatusChangedPayload) => void
  ): (() => void) => {
    const handler = (
      _e: IpcRendererEvent,
      payload: PreviewStatusChangedPayload
    ): void => {
      listener(payload);
    };
    ipcRenderer.on(IPC.PreviewStatusChanged, handler);
    return () => ipcRenderer.removeListener(IPC.PreviewStatusChanged, handler);
  },

  /** Subscribe to navigate requests from main (Cmd+P with a different
   *  page selected). */
  onNavigate: (
    listener: (payload: PreviewNavigatePayload) => void
  ): (() => void) => {
    const handler = (
      _e: IpcRendererEvent,
      payload: PreviewNavigatePayload
    ): void => {
      listener(payload);
    };
    ipcRenderer.on(IPC.PreviewNavigate, handler);
    return () => ipcRenderer.removeListener(IPC.PreviewNavigate, handler);
  },

  /** Request the current status synchronously (for late mounts). */
  getStatus: (projectPath: string): Promise<DevServerStatus> =>
    ipcRenderer.invoke(IPC.PreviewGetStatus, { projectPath }),

  /** Restart the dev server (used by the crashed-state Restart button). */
  restart: (projectPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.PreviewRestart, { projectPath }),

  /** Stop the dev server explicitly (admin escape hatch). */
  stop: (projectPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.PreviewStop, { projectPath }),
};

contextBridge.exposeInMainWorld('scampPreview', previewApi);

export type ScampPreviewApi = typeof previewApi;
