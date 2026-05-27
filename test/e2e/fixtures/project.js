import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AGENT_MD_CONTENT, AGENT_MD_CONTENT_LEGACY, CLAUDE_MD_CONTENT, DEFAULT_NEXT_CONFIG_TS, DEFAULT_PAGE_CSS, DEFAULT_THEME_CSS, defaultLayoutTsx, defaultPackageJson, defaultPageTsx, } from '../../../src/shared/agentMd';
const componentNameFromPage = (pageName) => pageName
    .split(/[-_]/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
const writePage = async (dir, name) => {
    await fs.writeFile(path.join(dir, `${name}.tsx`), defaultPageTsx(componentNameFromPage(name), name), 'utf-8');
    await fs.writeFile(path.join(dir, `${name}.module.css`), DEFAULT_PAGE_CSS, 'utf-8');
};
const defaultComponentTsx = (componentName) => `import styles from './${componentName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root}>
    </div>
  );
}
`;
const writeNextjsPage = async (dir, pageName, isHome) => {
    const pageDir = isHome ? path.join(dir, 'app') : path.join(dir, 'app', pageName);
    await fs.mkdir(pageDir, { recursive: true });
    await fs.writeFile(path.join(pageDir, 'page.tsx'), defaultPageTsx(componentNameFromPage(pageName), pageName, 'page'), 'utf-8');
    await fs.writeFile(path.join(pageDir, 'page.module.css'), DEFAULT_PAGE_CSS, 'utf-8');
};
const writeComponent = async (dir, seed) => {
    const componentDir = path.join(dir, 'components', seed.name);
    await fs.mkdir(componentDir, { recursive: true });
    await fs.writeFile(path.join(componentDir, `${seed.name}.tsx`), seed.tsxContent ?? defaultComponentTsx(seed.name), 'utf-8');
    await fs.writeFile(path.join(componentDir, `${seed.name}.module.css`), seed.cssContent ?? '.root {\n}\n', 'utf-8');
};
export const createTestProject = async (options = {}) => {
    const opts = typeof options === 'string' ? { name: options } : options;
    const name = opts.name ?? 'scamp-e2e';
    const format = opts.format ?? 'legacy';
    const extraPages = opts.extraPages ?? [];
    const components = opts.components ?? [];
    const pageContent = opts.pageContent ?? {};
    if (format === 'legacy' && components.length > 0) {
        throw new Error('createTestProject: legacy projects don\'t support components. Use format: "nextjs".');
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-'));
    const dir = path.join(root, name);
    await fs.mkdir(dir, { recursive: false });
    const pageName = 'home';
    if (format === 'legacy') {
        await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT_LEGACY, 'utf-8');
        await writePage(dir, pageName);
        for (const extra of extraPages) {
            await writePage(dir, extra);
        }
        await fs.writeFile(path.join(dir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');
    }
    else {
        await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT, 'utf-8');
        await fs.writeFile(path.join(dir, 'CLAUDE.md'), CLAUDE_MD_CONTENT, 'utf-8');
        await fs.writeFile(path.join(dir, 'package.json'), defaultPackageJson(name), 'utf-8');
        await fs.writeFile(path.join(dir, 'next.config.ts'), DEFAULT_NEXT_CONFIG_TS, 'utf-8');
        const appDir = path.join(dir, 'app');
        await fs.mkdir(appDir, { recursive: false });
        await fs.writeFile(path.join(appDir, 'layout.tsx'), defaultLayoutTsx(name), 'utf-8');
        await fs.writeFile(path.join(appDir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');
        await writeNextjsPage(dir, pageName, true);
        for (const extra of extraPages) {
            await writeNextjsPage(dir, extra, false);
        }
        await fs.mkdir(path.join(dir, 'public', 'assets'), { recursive: true });
        for (const seed of components) {
            await writeComponent(dir, seed);
        }
    }
    // Apply per-page content overrides on top of the scaffolded files.
    // Runs BEFORE the app launches so chokidar / format-migration don't
    // race the test's seed write.
    for (const [pn, overrides] of Object.entries(pageContent)) {
        const tsxPath = format === 'nextjs'
            ? path.join(dir, 'app', pn === pageName ? 'page.tsx' : path.join(pn, 'page.tsx'))
            : path.join(dir, `${pn}.tsx`);
        const cssPath = format === 'nextjs'
            ? path.join(dir, 'app', pn === pageName ? 'page.module.css' : path.join(pn, 'page.module.css'))
            : path.join(dir, `${pn}.module.css`);
        if (overrides.tsx !== undefined) {
            await fs.writeFile(tsxPath, overrides.tsx, 'utf-8');
        }
        if (overrides.css !== undefined) {
            await fs.writeFile(cssPath, overrides.css, 'utf-8');
        }
    }
    // Suppress the legacy → nextjs migration banner during tests.
    await fs.writeFile(path.join(dir, 'scamp.config.json'), JSON.stringify({ nextjsMigrationDismissed: true }, null, 2) + '\n', 'utf-8');
    const homeTsxPath = format === 'nextjs' ? path.join('app', 'page.tsx') : `${pageName}.tsx`;
    const homeCssPath = format === 'nextjs'
        ? path.join('app', 'page.module.css')
        : `${pageName}.module.css`;
    const themePath = format === 'nextjs' ? path.join('app', 'theme.css') : 'theme.css';
    const read = (file) => fs.readFile(path.join(dir, file), 'utf-8');
    const readPage = async (pn) => {
        if (format === 'nextjs') {
            const pageDir = pn === pageName ? 'app' : path.join('app', pn);
            const tsx = await read(path.join(pageDir, 'page.tsx'));
            const css = await read(path.join(pageDir, 'page.module.css'));
            return { tsx, css };
        }
        const tsx = await read(`${pn}.tsx`);
        const css = await read(`${pn}.module.css`);
        return { tsx, css };
    };
    const componentFilesFor = (componentName) => ({
        tsxPath: path.join(dir, 'components', componentName, `${componentName}.tsx`),
        cssPath: path.join(dir, 'components', componentName, `${componentName}.module.css`),
    });
    const readComponent = async (componentName) => {
        const { tsxPath, cssPath } = componentFilesFor(componentName);
        const [tsx, css] = await Promise.all([
            fs.readFile(tsxPath, 'utf-8'),
            fs.readFile(cssPath, 'utf-8'),
        ]);
        return { tsx, css };
    };
    const componentExists = async (componentName) => {
        const { tsxPath } = componentFilesFor(componentName);
        try {
            await fs.access(tsxPath);
            return true;
        }
        catch {
            return false;
        }
    };
    return {
        dir,
        name,
        pageName,
        format,
        readTsx: () => read(homeTsxPath),
        readCss: () => read(homeCssPath),
        readPage,
        readComponent,
        componentExists,
        readTheme: () => read(themePath),
        cleanup: async () => {
            await fs.rm(root, { recursive: true, force: true });
        },
    };
};
