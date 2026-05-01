import type { DevServerStatus, PreviewNavigatePayload, PreviewStatusChangedPayload } from '@shared/types';
/**
 * Tiny preload for the preview BrowserWindow. The preview's renderer
 * doesn't need the full Scamp API — only the channels for receiving
 * dev-server status updates, navigation requests, and triggering a
 * server restart.
 */
declare const previewApi: {
    /** Subscribe to status-changed events from main. Returns the
     *  unsubscribe function. */
    onStatusChanged: (listener: (payload: PreviewStatusChangedPayload) => void) => (() => void);
    /** Subscribe to navigate requests from main (Cmd+P with a different
     *  page selected). */
    onNavigate: (listener: (payload: PreviewNavigatePayload) => void) => (() => void);
    /** Request the current status synchronously (for late mounts). */
    getStatus: (projectPath: string) => Promise<DevServerStatus>;
    /** Restart the dev server (used by the crashed-state Restart button). */
    restart: (projectPath: string) => Promise<void>;
    /** Stop the dev server explicitly (admin escape hatch). */
    stop: (projectPath: string) => Promise<void>;
};
export type ScampPreviewApi = typeof previewApi;
export {};
