import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AGENT_MD_CONTENT_LEGACY, DEFAULT_PAGE_CSS, DEFAULT_THEME_CSS, defaultPageTsx, } from '../../../src/shared/agentMd';
const componentNameFromPage = (pageName) => pageName
    .split(/[-_]/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
export const createTestProject = async (name = 'scamp-e2e') => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-'));
    const dir = path.join(root, name);
    await fs.mkdir(dir, { recursive: false });
    const pageName = 'home';
    const componentName = componentNameFromPage(pageName);
    await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT_LEGACY, 'utf-8');
    await fs.writeFile(path.join(dir, `${pageName}.tsx`), defaultPageTsx(componentName, pageName), 'utf-8');
    await fs.writeFile(path.join(dir, `${pageName}.module.css`), DEFAULT_PAGE_CSS, 'utf-8');
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
