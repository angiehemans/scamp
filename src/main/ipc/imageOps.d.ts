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
 * **May not copy at all.** When the chosen file already IS the asset at
 * the destination path, it's returned as-is (`reused: true`). Without
 * that check the dedupe loop below doesn't just fail to notice — it
 * guarantees a duplicate, since the destination is occupied by the very
 * file being imported. All three image pickers open in the assets
 * folder, so re-choosing an existing asset is a common action.
 *
 * Returns the runtime reference path as `relativePath` (the field name
 * predates the nextjs format, where the path is actually absolute
 * server-root; kept for compatibility with existing call sites).
 */
export declare const copyImage: (args: CopyImageArgs, format: ProjectFormat) => Promise<CopyImageResult>;
/**
 * Write an in-memory image buffer into the project's assets folder
 * (deduplicating the filename), returning the runtime reference. Used by
 * the clipboard-paste path, where there's no source file to copy.
 */
export declare const saveImageBuffer: (projectPath: string, data: Buffer, baseName: string, ext: string, format: ProjectFormat) => Promise<CopyImageResult>;
