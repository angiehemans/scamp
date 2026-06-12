import type { ProjectFormat } from '@shared/types';
/**
 * Path on disk where a project's `theme.css` lives. Nextjs projects
 * co-locate it inside `app/` so the root layout can import it and
 * `next dev` picks up the tokens; legacy keeps it at the project root.
 *
 * Pure w.r.t. `format` — the handler reads it from the project format
 * cache (mirrors the imageOps pattern).
 */
export declare const themePathFor: (projectPath: string, format: ProjectFormat) => string;
/**
 * Read the project's theme.css. Returns the file content as a string,
 * or an empty string if the file doesn't exist.
 */
export declare const readThemeFile: (projectPath: string, format: ProjectFormat) => Promise<string>;
/** Write the project's theme.css, replacing its entire content. */
export declare const writeThemeFile: (projectPath: string, format: ProjectFormat, content: string) => Promise<void>;
