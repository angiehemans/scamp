import { promises as fs } from 'fs';
import { join } from 'path';
/**
 * Path on disk where a project's `theme.css` lives. Nextjs projects
 * co-locate it inside `app/` so the root layout can import it and
 * `next dev` picks up the tokens; legacy keeps it at the project root.
 *
 * Pure w.r.t. `format` — the handler reads it from the project format
 * cache (mirrors the imageOps pattern).
 */
export const themePathFor = (projectPath, format) => format === 'nextjs'
    ? join(projectPath, 'app', 'theme.css')
    : join(projectPath, 'theme.css');
/**
 * Read the project's theme.css. Returns the file content as a string,
 * or an empty string if the file doesn't exist.
 */
export const readThemeFile = async (projectPath, format) => {
    try {
        return await fs.readFile(themePathFor(projectPath, format), 'utf-8');
    }
    catch {
        return '';
    }
};
/** Write the project's theme.css, replacing its entire content. */
export const writeThemeFile = async (projectPath, format, content) => {
    await fs.writeFile(themePathFor(projectPath, format), content, 'utf-8');
};
