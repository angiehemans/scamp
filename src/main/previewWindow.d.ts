/**
 * Open or reuse the preview window for a project. Returns the
 * BrowserWindow for the IPC layer to surface its `id` to callers.
 */
export declare const openPreviewWindow: (projectPath: string, pageName: string) => Promise<{
    id: number;
}>;
/**
 * Close the preview window for a project (if any) — used when the
 * user closes the project itself. Doesn't touch the dev server;
 * `stopDevServer` is a separate call.
 */
export declare const closePreviewWindow: (projectPath: string) => void;
/** Iterate every open preview window — used by the app-quit hook. */
export declare const closeAllPreviewWindows: () => void;
