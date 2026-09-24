import type { CapturedSource } from '@shared/importCapture';
export type StoredSource = {
    view: string;
    htmlPath: string;
    cssPath: string;
    htmlBytes: number;
    cssBytes: number;
    url: string;
    unreadable: string[];
    truncated: boolean;
};
/**
 * Point the store at a project, removing whatever the last one left.
 *
 * Called where a project opens. "The project is closed" and "a
 * different project opened" are the same event from here, and the app
 * only ever has one open at a time.
 */
export declare const setActiveImportProject: (projectPath: string | null) => Promise<void>;
/** Write one page's original beside the view it became. */
export declare const saveImportSource: (projectPath: string, view: string, url: string, source: CapturedSource) => Promise<StoredSource>;
/** Every original kept for this project, newest first. */
export declare const listImportSources: (projectPath: string) => Promise<StoredSource[]>;
/** One original's text, and how much of it there was. */
export declare const readImportSource: (projectPath: string, view: string, part: "html" | "css", limit: number) => Promise<{
    stored: StoredSource;
    text: string;
    truncated: boolean;
} | null>;
/** Remove one project's originals, or everything this process wrote. */
export declare const disposeImportSources: (projectPath?: string) => Promise<void>;
