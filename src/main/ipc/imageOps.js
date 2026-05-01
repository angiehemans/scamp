import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
/**
 * Where image assets live on disk for a given project format.
 *
 *   - legacy: `<project>/assets/` (referenced as `./assets/<file>`)
 *   - nextjs: `<project>/public/assets/` (Next.js serves `public/`
 *     at the URL root, so the runtime reference is `/assets/<file>`)
 */
export const assetsDirFor = (projectPath, format) => format === 'nextjs'
    ? join(projectPath, 'public', 'assets')
    : join(projectPath, 'assets');
/**
 * The runtime reference path that lands on `el.src` / in CSS
 * `url(...)` declarations. Legacy uses a relative-to-project path so
 * exported HTML works when opened directly; nextjs uses an absolute
 * server-root path because Next.js serves `public/` at `/`.
 */
const referencePathFor = (fileName, format) => format === 'nextjs' ? `/assets/${fileName}` : `./assets/${fileName}`;
/**
 * Copy an image into the project's assets folder, deduplicating the
 * filename if it collides. Pure with respect to `format` — the caller
 * (`registerImageIpc`) reads it from the project format cache.
 *
 * Returns the runtime reference path as `relativePath` (the field name
 * predates the nextjs format, where the path is actually absolute
 * server-root; kept for compatibility with existing call sites).
 */
export const copyImage = async (args, format) => {
    const assetsDir = assetsDirFor(args.projectPath, format);
    await fs.mkdir(assetsDir, { recursive: true });
    const ext = extname(args.sourcePath);
    const base = basename(args.sourcePath, ext);
    let fileName = `${base}${ext}`;
    let destPath = join(assetsDir, fileName);
    // Deduplicate: hero.png → hero-1.png → hero-2.png
    let counter = 1;
    while (true) {
        try {
            await fs.access(destPath);
            fileName = `${base}-${counter}${ext}`;
            destPath = join(assetsDir, fileName);
            counter += 1;
        }
        catch {
            break; // File doesn't exist — safe to use this name.
        }
    }
    await fs.copyFile(args.sourcePath, destPath);
    return {
        relativePath: referencePathFor(fileName, format),
        fileName,
    };
};
