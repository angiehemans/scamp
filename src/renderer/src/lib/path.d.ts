import type { ProjectFormat } from '@shared/types';
/**
 * Lightweight basename helper for the renderer. Avoids importing Node's
 * `path` module from the renderer, which has no business reading the
 * filesystem (CLAUDE.md rule).
 */
export declare const basename: (p: string) => string;
/**
 * Project-relative path of the assets directory for the given format.
 * Used to construct the `defaultPath` for the native file dialog so it
 * opens in the right folder. Always uses forward slashes — the main
 * process normalises separators per-platform.
 */
export declare const assetsDirSegment: (format: ProjectFormat) => string;
