/**
 * Open or reuse the preview window for a project. Returns the
 * BrowserWindow for the IPC layer to surface its `id` to callers.
 */
/**
 * Update the active page + page list on an EXISTING preview window
 * without creating one. Called by the parent renderer when the
 * project's page list changes (page added / renamed / deleted) so
 * the URL-bar dropdown stays accurate. No-op when no preview window
 * is open for the project — we don't want this to silently spawn
 * a new preview just because pages shifted.
 */
export declare const updatePreviewWindow: (projectPath: string, pageName: string, pageNames: ReadonlyArray<string>) => void;
export declare const openPreviewWindow: (projectPath: string, pageName: string, pageNames: ReadonlyArray<string>) => Promise<{
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
