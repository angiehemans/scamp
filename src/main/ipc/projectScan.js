import { promises as fs } from 'fs';
import { join } from 'path';
import { detectProjectFormat } from './projectFormat';
import { CONFIG_FILE } from './projectConfigOps';
/** Subdirectories never worth scanning as projects. */
const SKIP_DIRS = new Set(['node_modules']);
/**
 * Does this folder look like a Scamp project? A folder qualifies if it
 * has any of:
 *   - `scamp.config.json` (written for every project Scamp opens/creates)
 *   - `app/page.tsx`       (nextjs layout)
 *   - any `*.tsx` at the root (legacy layout)
 *
 * This is stricter than `detectProjectFormat`, which defaults *any*
 * folder to `nextjs` — we must not list arbitrary subfolders as
 * projects. Case-sensitivity isn't a factor here: every check is for a
 * known lowercase filename, so the same string compares the same way on
 * APFS and Linux.
 */
export const isScampProjectDir = async (folderPath) => {
    try {
        await fs.access(join(folderPath, CONFIG_FILE));
        return true;
    }
    catch {
        // fall through
    }
    try {
        await fs.access(join(folderPath, 'app', 'page.tsx'));
        return true;
    }
    catch {
        // fall through
    }
    try {
        const entries = await fs.readdir(folderPath);
        if (entries.some((e) => e.endsWith('.tsx')))
            return true;
    }
    catch {
        // unreadable folder — not a project we can list
    }
    return false;
};
/**
 * Scan a folder one level deep for Scamp projects. Each immediate
 * subdirectory that looks like a project is returned with its
 * freshly-detected format. Best-effort: an unreadable root yields `[]`
 * and an unreadable / non-project subdir is skipped.
 */
export const scanProjectsInFolder = async (folder) => {
    let entries;
    try {
        entries = await fs.readdir(folder, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name));
    const results = await Promise.all(dirs.map(async (dir) => {
        const path = join(folder, dir.name);
        if (!(await isScampProjectDir(path)))
            return null;
        const format = await detectProjectFormat(path);
        return { name: dir.name, path, format };
    }));
    return results.filter((p) => p !== null);
};
