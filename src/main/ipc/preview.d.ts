type PreviewWindowApi = {
    open: (projectPath: string, pageName: string) => Promise<{
        id: number;
    }>;
    close: (projectPath: string) => void;
};
/**
 * Register the IPC handlers preview mode needs. Idempotent — safe
 * to call once at app startup.
 *
 * The window functions are injected so this module doesn't pull in
 * the BrowserWindow code path directly.
 */
export declare const registerPreviewIpc: (windowApi: PreviewWindowApi) => void;
export {};
