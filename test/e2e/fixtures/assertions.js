import { expect } from '@playwright/test';
import { promises as fs } from 'fs';
import * as path from 'path';
import { viewNameForPage } from '../../../src/shared/templates';
import { saveStatus } from './selectors';
const exists = (file) => fs.access(file).then(() => true, () => false);
/**
 * The page's TSX and CSS module, wherever the project's format keeps
 * them: `views/<Name>/` in a framework project, `app/` in a Next.js
 * one, the root in a legacy one. Probed from disk so a spec reads the
 * same way under `SCAMP_E2E_FORMAT`.
 */
export const readPageFiles = async (projectDir, pageName) => {
    const view = viewNameForPage(pageName);
    const viewTsx = path.join(projectDir, 'views', view, `${view}.tsx`);
    const appDir = pageName === 'home' ? path.join(projectDir, 'app') : path.join(projectDir, 'app', pageName);
    const [tsxPath, cssPath] = (await exists(viewTsx))
        ? [viewTsx, path.join(projectDir, 'views', view, `${view}.module.css`)]
        : (await exists(path.join(appDir, 'page.tsx')))
            ? [path.join(appDir, 'page.tsx'), path.join(appDir, 'page.module.css')]
            : [path.join(projectDir, `${pageName}.tsx`), path.join(projectDir, `${pageName}.module.css`)];
    const [tsx, css] = await Promise.all([
        fs.readFile(tsxPath, 'utf-8'),
        fs.readFile(cssPath, 'utf-8'),
    ]);
    return { tsx, css };
};
/** Does this absolute path exist? For paths the fixture already resolved. */
export const fileExists = async (absolute) => {
    try {
        await fs.access(absolute);
        return true;
    }
    catch {
        return false;
    }
};
export const projectFileExists = async (projectDir, name) => {
    try {
        await fs.access(path.join(projectDir, name));
        return true;
    }
    catch {
        return false;
    }
};
/**
 * Wait until the save-status indicator lands on `saved`. The sync
 * bridge debounces writes ~200 ms, then the IPC round-trip + watcher
 * ack take another beat — settle time is usually <1 s in tests but
 * can spike on slow CI, so we give this a generous timeout.
 */
export const waitForSaved = async (page, timeout = 10_000) => {
    await expect(saveStatus(page)).toHaveAttribute('data-status', 'saved', {
        timeout,
    });
};
