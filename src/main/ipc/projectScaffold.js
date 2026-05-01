import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { AGENT_MD_CONTENT, AGENT_MD_CONTENT_LEGACY, DEFAULT_NEXT_CONFIG_TS, DEFAULT_PAGE_CSS, DEFAULT_THEME_CSS, defaultLayoutTsx, defaultPackageJson, defaultPageTsx, } from '@shared/agentMd';
import { decideLayoutMigration } from '@shared/layoutMigration';
const componentNameFromPage = (pageName) => pageName
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
/**
 * Path on disk where a project's `theme.css` lives. Nextjs projects
 * co-locate it inside `app/` so the root layout can import it and
 * `next dev` picks up the tokens; legacy keeps it at the project root.
 */
export const themePathFor = (projectPath, format) => format === 'nextjs'
    ? join(projectPath, 'app', 'theme.css')
    : join(projectPath, 'theme.css');
/**
 * Read a single page (TSX + CSS pair) from disk, returning null when
 * the pair is incomplete (one half missing) so callers can skip it
 * without crashing the project open.
 */
const readPage = async (name, tsxPath, cssPath) => {
    try {
        const [tsxContent, cssContent] = await Promise.all([
            fs.readFile(tsxPath, 'utf-8'),
            fs.readFile(cssPath, 'utf-8'),
        ]);
        return { name, tsxPath, cssPath, tsxContent, cssContent };
    }
    catch {
        return null;
    }
};
export const readProjectLegacy = async (folderPath) => {
    const entries = await fs.readdir(folderPath);
    const tsxFiles = entries.filter((f) => f.endsWith('.tsx'));
    const pages = [];
    for (const tsxFile of tsxFiles) {
        const baseName = tsxFile.replace(/\.tsx$/, '');
        const cssFile = `${baseName}.module.css`;
        if (!entries.includes(cssFile))
            continue;
        const page = await readPage(baseName, join(folderPath, tsxFile), join(folderPath, cssFile));
        if (page)
            pages.push(page);
    }
    return pages;
};
/**
 * Read pages from a Next.js App Router project layout. The root page
 * lives at `app/page.tsx` and is keyed as `'home'` internally so the
 * rest of the app (sidebar labelling, component-name derivation, page
 * switching) works without special-casing. Additional pages live in
 * folders inside `app/` — e.g. `app/about/page.tsx` is keyed `'about'`.
 */
export const readProjectNextjs = async (folderPath) => {
    const appDir = join(folderPath, 'app');
    const pages = [];
    // Root / home page
    const homePage = await readPage('home', join(appDir, 'page.tsx'), join(appDir, 'page.module.css'));
    if (homePage)
        pages.push(homePage);
    // Nested page folders
    let entries = [];
    try {
        entries = await fs.readdir(appDir, { withFileTypes: true });
    }
    catch {
        return pages;
    }
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const page = await readPage(entry.name, join(appDir, entry.name, 'page.tsx'), join(appDir, entry.name, 'page.module.css'));
        if (page)
            pages.push(page);
    }
    return pages;
};
/**
 * Write the Next.js App Router scaffold into a freshly-created
 * project folder. Creates `app/` (with the home page, layout, and
 * `theme.css` co-located so `next dev` picks up the tokens),
 * `public/assets/`, and the auto-generated `package.json` /
 * `next.config.ts` at the project root.
 *
 * Caller is responsible for creating the project directory itself
 * and for writing `scamp.config.json` (via `ensureProjectConfig`).
 */
export const scaffoldNextjsProject = async (projectPath, projectName) => {
    await fs.writeFile(join(projectPath, 'agent.md'), AGENT_MD_CONTENT, 'utf-8');
    await fs.writeFile(join(projectPath, 'package.json'), defaultPackageJson(projectName), 'utf-8');
    await fs.writeFile(join(projectPath, 'next.config.ts'), DEFAULT_NEXT_CONFIG_TS, 'utf-8');
    const appDir = join(projectPath, 'app');
    await fs.mkdir(appDir, { recursive: false });
    await fs.writeFile(join(appDir, 'layout.tsx'), defaultLayoutTsx(projectName), 'utf-8');
    await fs.writeFile(join(appDir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');
    const componentName = componentNameFromPage('home');
    await fs.writeFile(join(appDir, 'page.tsx'), defaultPageTsx(componentName, 'home', 'page'), 'utf-8');
    await fs.writeFile(join(appDir, 'page.module.css'), DEFAULT_PAGE_CSS, 'utf-8');
    await fs.mkdir(join(projectPath, 'public', 'assets'), { recursive: true });
};
/**
 * Refresh `app/layout.tsx` if it byte-matches a known legacy template.
 * Called on project open so old projects pick up the body reset
 * (`margin: 0; min-height: 100vh`) without a manual edit. User-
 * customised layouts are left alone — `decideLayoutMigration` returns
 * `'warn'` and we surface a one-line hint via the main-process console
 * so users hitting "preview is blank" can find the cause.
 *
 * Idempotent: subsequent calls with the latest template are a no-op
 * (no log spam on repeat opens).
 */
export const refreshLayoutTemplateIfNeeded = async (projectPath) => {
    const layoutPath = join(projectPath, 'app', 'layout.tsx');
    let current;
    try {
        current = await fs.readFile(layoutPath, 'utf-8');
    }
    catch {
        // No layout.tsx — caller is opening a non-nextjs project or a
        // project with a missing scaffold. Nothing to migrate.
        return;
    }
    const projectName = basename(projectPath);
    const action = decideLayoutMigration(current, projectName);
    if (action.kind === 'noop')
        return;
    if (action.kind === 'replace') {
        await fs.writeFile(layoutPath, action.next, 'utf-8');
        return;
    }
    // 'warn' — log a one-line hint. Doesn't surface a UI banner; the
    // hint is for users debugging a blank-preview issue.
    console.warn(`[layout-migration] ${layoutPath}: ${action.reason}`);
};
/**
 * Legacy flat-layout scaffold. Kept around for the migrator's
 * fixture-creation tests and for parity in the shared scaffold module.
 */
export const scaffoldLegacyProject = async (projectPath) => {
    await fs.writeFile(join(projectPath, 'agent.md'), AGENT_MD_CONTENT_LEGACY, 'utf-8');
    const componentName = componentNameFromPage('home');
    await fs.writeFile(join(projectPath, 'home.tsx'), defaultPageTsx(componentName, 'home'), 'utf-8');
    await fs.writeFile(join(projectPath, 'home.module.css'), DEFAULT_PAGE_CSS, 'utf-8');
    await fs.writeFile(join(projectPath, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');
};
