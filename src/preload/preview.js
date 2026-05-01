import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipcChannels';
/**
 * Tiny preload for the preview BrowserWindow. The preview's renderer
 * doesn't need the full Scamp API — only the channels for receiving
 * dev-server status updates, navigation requests, and triggering a
 * server restart.
 */
const previewApi = {
    /** Subscribe to status-changed events from main. Returns the
     *  unsubscribe function. */
    onStatusChanged: (listener) => {
        const handler = (_e, payload) => {
            listener(payload);
        };
        ipcRenderer.on(IPC.PreviewStatusChanged, handler);
        return () => ipcRenderer.removeListener(IPC.PreviewStatusChanged, handler);
    },
    /** Subscribe to navigate requests from main (Cmd+P with a different
     *  page selected). */
    onNavigate: (listener) => {
        const handler = (_e, payload) => {
            listener(payload);
        };
        ipcRenderer.on(IPC.PreviewNavigate, handler);
        return () => ipcRenderer.removeListener(IPC.PreviewNavigate, handler);
    },
    /** Request the current status synchronously (for late mounts). */
    getStatus: (projectPath) => ipcRenderer.invoke(IPC.PreviewGetStatus, { projectPath }),
    /** Restart the dev server (used by the crashed-state Restart button). */
    restart: (projectPath) => ipcRenderer.invoke(IPC.PreviewRestart, { projectPath }),
    /** Stop the dev server explicitly (admin escape hatch). */
    stop: (projectPath) => ipcRenderer.invoke(IPC.PreviewStop, { projectPath }),
};
contextBridge.exposeInMainWorld('scampPreview', previewApi);
