import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AGENT_MD_CONTENT_LEGACY, DEFAULT_PAGE_CSS, DEFAULT_THEME_CSS, defaultPageTsx, } from '../../../src/shared/agentMd';
const componentNameFromPage = (pageName) => pageName
    .split(/[-_]/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
const writePage = async (dir, name) => {
    await fs.writeFile(path.join(dir, `${name}.tsx`), defaultPageTsx(componentNameFromPage(name), name), 'utf-8');
    await fs.writeFile(path.join(dir, `${name}.module.css`), DEFAULT_PAGE_CSS, 'utf-8');
};
export const createTestProject = async (options = {}) => {
    // Backwards-compat: callers used to pass the name as a string
    // positional. Keep that working so wave-1 fixtures don't have to
    // change.
    const opts = typeof options === 'string' ? { name: options } : options;
    const name = opts.name ?? 'scamp-e2e';
    const extraPages = opts.extraPages ?? [];
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-'));
    const dir = path.join(root, name);
    await fs.mkdir(dir, { recursive: false });
    const pageName = 'home';
    await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT_LEGACY, 'utf-8');
    await writePage(dir, pageName);
    for (const extra of extraPages) {
        await writePage(dir, extra);
    }
    await fs.writeFile(path.join(dir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');
    // Suppress the legacy → nextjs migration banner so it doesn't sit on
    // top of the canvas during tests. `parseProjectConfig` fills in the
    // other fields (artboardBackground, canvasWidth, breakpoints, …)
    // from defaults on first read.
    await fs.writeFile(path.join(dir, 'scamp.config.json'), JSON.stringify({ nextjsMigrationDismissed: true }, null, 2) + '\n', 'utf-8');
    const read = (file) => fs.readFile(path.join(dir, file), 'utf-8');
    return {
        dir,
        name,
        pageName,
        readTsx: () => read(`${pageName}.tsx`),
        readCss: () => read(`${pageName}.module.css`),
        readTheme: () => read('theme.css'),
        cleanup: async () => {
            await fs.rm(root, { recursive: true, force: true });
        },
    };
};
