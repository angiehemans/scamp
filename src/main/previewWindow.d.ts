import type { PreviewOpenArgs } from '@shared/types';
export declare const updatePreviewWindow: (args: PreviewOpenArgs) => void;
export declare const openPreviewWindow: (args: PreviewOpenArgs) => Promise<{
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
