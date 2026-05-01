import type { CopyImageArgs, CopyImageResult, ProjectFormat } from '@shared/types';
/**
 * Where image assets live on disk for a given project format.
 *
 *   - legacy: `<project>/assets/` (referenced as `./assets/<file>`)
 *   - nextjs: `<project>/public/assets/` (Next.js serves `public/`
 *     at the URL root, so the runtime reference is `/assets/<file>`)
 */
export declare const assetsDirFor: (projectPath: string, format: ProjectFormat) => string;
/**
 * Copy an image into the project's assets folder, deduplicating the
 * filename if it collides. Pure with respect to `format` — the caller
 * (`registerImageIpc`) reads it from the project format cache.
 *
 * Returns the runtime reference path as `relativePath` (the field name
 * predates the nextjs format, where the path is actually absolute
 * server-root; kept for compatibility with existing call sites).
 */
export declare const copyImage: (args: CopyImageArgs, format: ProjectFormat) => Promise<CopyImageResult>;
