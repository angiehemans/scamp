import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
/**
 * The nextjs → scamp migration, end to end: the banner on a Next.js
 * project, the confirm, and the project that comes back. A page's
 * markup must survive byte for byte inside its new view, which is what
 * lets the canvas look the same the moment the project reopens.
 * see docs/notes/nextjs-sunset.md
 */
const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <header data-scamp-id="hero_a1b2" className={styles.hero_a1b2}>
        <h1 data-scamp-id="title_c3d4" className={styles.title_c3d4}>Hello</h1>
      </header>
    </div>
  );
}
`;
const HOME_CSS = `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.hero_a1b2 {
  width: 100%;
  padding: 24px;
  background: #223344;
}

.title_c3d4 {
  width: 200px;
  font-size: 32px;
}
`;
/** The JSX between `return (` and `);`, which is what the migration promises to keep. */
const markup = (tsx) => {
    const start = tsx.indexOf('return (');
    const end = tsx.lastIndexOf(');');
    return tsx.slice(start, end);
};
test.describe('migrate a Next.js project to the Scamp framework', () => {
    test.use({
        projectOptions: {
            format: 'nextjs',
            scampMigrationBanner: true,
            extraPages: ['about'],
            pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
            components: [{ name: 'Card' }],
        },
    });
    test('turns pages into views and routes, moves the theme, swaps the stack, and reports the rest', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Something Scamp never wrote: an API route the migration must leave alone.
        await fs.mkdir(path.join(project.dir, 'app', 'api', 'ping'), { recursive: true });
        await fs.writeFile(path.join(project.dir, 'app', 'api', 'ping', 'route.ts'), "export async function GET() { return new Response('pong'); }\n", 'utf-8');
        const banner = window.getByTestId('scamp-migration-banner');
        await expect(banner).toBeVisible();
        await banner.getByRole('button', { name: 'Migrate to the Scamp framework' }).click();
        await window.getByRole('button', { name: 'Migrate', exact: true }).click();
        await expect(banner).toBeHidden({ timeout: 30_000 });
        const dir = project.dir;
        const read = (file) => fs.readFile(path.join(dir, file), 'utf-8');
        const exists = (file) => fs.access(path.join(dir, file)).then(() => true, () => false);
        // Views and routes for both pages; the home route at index.
        const homeView = await read('views/Home/Home.tsx');
        expect(homeView).toContain("import styles from './Home.module.css';");
        expect(homeView).toContain('export const _scamp');
        expect(markup(homeView).replace('className={`${styles.root} ${className ?? \'\'}`}', 'className={styles.root}')).toBe(markup(HOME_TSX));
        expect(await read('routes/index.tsx')).toContain("import Home from '@/views/Home/Home';");
        expect(await exists('views/About/About.tsx')).toBe(true);
        expect(await read('routes/about.tsx')).toContain('<About />');
        // The home view's CSS drops the page-root viewport floor, and keeps the rest.
        const homeCss = await read('views/Home/Home.module.css');
        expect(homeCss).toContain('.hero_a1b2');
        expect(homeCss).not.toContain('min-height: 100vh');
        // Theme under design/, with the body rules the Next.js layout carried inline.
        const theme = await read('design/theme.css');
        expect(theme).toContain('--color-primary');
        expect(theme).toMatch(/body\s*\{[^}]*margin:\s*0/);
        // The stack swapped, everything else kept.
        const pkg = JSON.parse(await read('package.json'));
        expect(pkg.scripts['dev']).toBe('scamp dev');
        expect(pkg.dependencies['scampjs']).toMatch(/^\^0\./);
        expect(pkg.dependencies['preact']).toBeDefined();
        expect(pkg.dependencies['next']).toBeUndefined();
        expect(pkg.devDependencies?.['typescript']).toBeDefined();
        expect(pkg.devDependencies?.['@types/react']).toBeUndefined();
        expect(await exists('scamp-env.d.ts')).toBe(true);
        expect(await exists('next.config.ts')).toBe(false);
        expect(await exists('app/page.tsx')).toBe(false);
        expect(await exists('app/layout.tsx')).toBe(false);
        // The component was already the right shape and stayed put.
        expect(await exists('components/Card/Card.tsx')).toBe(true);
        // What Scamp never wrote is still there.
        expect(await exists('app/api/ping/route.ts')).toBe(true);
        // The backup keeps the Next.js files at their paths.
        const entries = await fs.readdir(dir);
        const backup = entries.find((e) => e.startsWith('.scamp-backup-'));
        expect(backup).toBeDefined();
        expect(await exists(path.join(backup ?? '', 'app', 'layout.tsx'))).toBe(true);
        expect(await exists(path.join(backup ?? '', 'package.json'))).toBe(true);
        // The project reopened as a framework project with its views under Pages.
        await expect(window.getByRole('button', { name: 'home', exact: true }).first()).toBeVisible();
        await expect(window.getByRole('button', { name: 'about', exact: true }).first()).toBeVisible();
        await expect(window.getByTestId('preview-button')).toBeEnabled();
    });
});
