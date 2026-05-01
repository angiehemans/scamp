import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { migrateLegacyToNextjs, rewriteAssetReferences, } from '../../src/main/ipc/projectMigrate';
import { detectProjectFormat } from '../../src/main/ipc/projectFormat';
import { readProjectNextjs, scaffoldLegacyProject, } from '../../src/main/ipc/projectScaffold';
describe('rewriteAssetReferences', () => {
    it('rewrites url("./assets/foo.png") to url("/assets/foo.png")', () => {
        const css = `.hero { background: url("./assets/hero.png"); }`;
        expect(rewriteAssetReferences(css)).toBe(`.hero { background: url("/assets/hero.png"); }`);
    });
    it("rewrites single-quoted url('./assets/...') variants", () => {
        expect(rewriteAssetReferences(`url('./assets/x.svg')`)).toBe(`url('/assets/x.svg')`);
    });
    it('rewrites unquoted url(./assets/...) variants', () => {
        expect(rewriteAssetReferences(`url(./assets/x.svg)`)).toBe(`url(/assets/x.svg)`);
    });
    it('rewrites JSX src="./assets/..." attributes', () => {
        const tsx = `<img src="./assets/hero.png" alt="" />`;
        expect(rewriteAssetReferences(tsx)).toBe(`<img src="/assets/hero.png" alt="" />`);
    });
    it('leaves unrelated strings alone', () => {
        // The migrator must not touch a string literal that happens to
        // contain `./assets/`.
        const tsx = `const message = "open ./assets/ in your editor";`;
        expect(rewriteAssetReferences(tsx)).toBe(tsx);
    });
    it('leaves agent-written /assets/ references untouched (idempotent)', () => {
        const css = `background: url("/assets/hero.png");`;
        expect(rewriteAssetReferences(css)).toBe(css);
    });
});
describe('migrateLegacyToNextjs', () => {
    let projectDir;
    let parentDir;
    beforeEach(async () => {
        parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-migrate-'));
        projectDir = path.join(parentDir, 'my-project');
        await fs.mkdir(projectDir);
        await scaffoldLegacyProject(projectDir);
    });
    afterEach(async () => {
        await fs.rm(parentDir, { recursive: true, force: true });
    });
    it('migrates a single-page legacy project to nextjs format', async () => {
        const result = await migrateLegacyToNextjs(projectDir);
        expect(await detectProjectFormat(projectDir)).toBe('nextjs');
        expect(result.unmovedFiles).toEqual([]);
        // app/page.tsx exists with the new import line
        const tsx = await fs.readFile(path.join(projectDir, 'app', 'page.tsx'), 'utf-8');
        expect(tsx).toContain(`import styles from './page.module.css';`);
        expect(tsx).not.toContain(`./home.module.css`);
        // app/layout.tsx imports theme.css
        const layout = await fs.readFile(path.join(projectDir, 'app', 'layout.tsx'), 'utf-8');
        expect(layout).toContain(`import './theme.css';`);
        // theme.css moved into app/
        const themeAtRoot = await fs
            .access(path.join(projectDir, 'theme.css'))
            .then(() => true)
            .catch(() => false);
        expect(themeAtRoot).toBe(false);
        const themeInApp = await fs.readFile(path.join(projectDir, 'app', 'theme.css'), 'utf-8');
        expect(themeInApp).toContain('--color-primary');
        // package.json + next.config.ts at the root
        const pkg = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8'));
        expect(pkg.dependencies.next).toBeDefined();
        expect(await fs.access(path.join(projectDir, 'next.config.ts'))
            .then(() => true)
            .catch(() => false)).toBe(true);
    });
    it('keeps the original files in a backup directory', async () => {
        const result = await migrateLegacyToNextjs(projectDir);
        expect(result.backupPath).toMatch(/\.scamp-backup-/);
        const backupContents = (await fs.readdir(result.backupPath)).sort();
        // home.tsx + home.module.css + theme.css + agent.md
        expect(backupContents).toContain('home.tsx');
        expect(backupContents).toContain('home.module.css');
        expect(backupContents).toContain('theme.css');
        expect(backupContents).toContain('agent.md');
    });
    it('migrates multi-page projects, preserving each page', async () => {
        // Add a second page in the legacy layout.
        await fs.writeFile(path.join(projectDir, 'about.tsx'), `import styles from './about.module.css';\nexport default function About() { return <div data-scamp-id="root" className={styles.root} />; }\n`, 'utf-8');
        await fs.writeFile(path.join(projectDir, 'about.module.css'), `.root { background: red; }\n`, 'utf-8');
        await migrateLegacyToNextjs(projectDir);
        const pages = await readProjectNextjs(projectDir);
        expect(pages.map((p) => p.name).sort()).toEqual(['about', 'home']);
        const aboutTsx = await fs.readFile(path.join(projectDir, 'app', 'about', 'page.tsx'), 'utf-8');
        expect(aboutTsx).toContain(`import styles from './page.module.css';`);
        expect(aboutTsx).not.toContain(`./about.module.css`);
    });
    it('moves assets/ into public/assets/ and rewrites references', async () => {
        // Set up a legacy asset and a CSS reference to it.
        await fs.mkdir(path.join(projectDir, 'assets'));
        await fs.writeFile(path.join(projectDir, 'assets', 'hero.png'), 'PNG-bytes', 'utf-8');
        await fs.writeFile(path.join(projectDir, 'home.module.css'), `.root {\n  background: url('./assets/hero.png');\n}\n`, 'utf-8');
        await fs.writeFile(path.join(projectDir, 'home.tsx'), `import styles from './home.module.css';\nexport default function Home() { return <img src="./assets/hero.png" alt="" />; }\n`, 'utf-8');
        await migrateLegacyToNextjs(projectDir);
        // Asset moved
        const heroAtPublic = await fs.readFile(path.join(projectDir, 'public', 'assets', 'hero.png'), 'utf-8');
        expect(heroAtPublic).toBe('PNG-bytes');
        const heroAtLegacy = await fs
            .access(path.join(projectDir, 'assets'))
            .then(() => true)
            .catch(() => false);
        expect(heroAtLegacy).toBe(false);
        // CSS reference rewritten
        const css = await fs.readFile(path.join(projectDir, 'app', 'page.module.css'), 'utf-8');
        expect(css).toContain(`url('/assets/hero.png')`);
        expect(css).not.toContain(`./assets/`);
        // TSX reference rewritten
        const tsx = await fs.readFile(path.join(projectDir, 'app', 'page.tsx'), 'utf-8');
        expect(tsx).toContain(`src="/assets/hero.png"`);
        expect(tsx).not.toContain(`src="./assets/`);
    });
    it('leaves unrecognised root-level files in place and reports them', async () => {
        await fs.writeFile(path.join(projectDir, 'README.md'), '# Notes\n', 'utf-8');
        await fs.writeFile(path.join(projectDir, 'scratch.txt'), 'wip', 'utf-8');
        const result = await migrateLegacyToNextjs(projectDir);
        expect(result.unmovedFiles.sort()).toEqual(['README.md', 'scratch.txt']);
        // Files still at the project root.
        const readme = await fs.readFile(path.join(projectDir, 'README.md'), 'utf-8');
        expect(readme).toBe('# Notes\n');
    });
    it('moves scamp.config.json into the backup (it is recreated by openProject)', async () => {
        await fs.writeFile(path.join(projectDir, 'scamp.config.json'), '{}', 'utf-8');
        const result = await migrateLegacyToNextjs(projectDir);
        expect(await fs.readdir(result.backupPath)).toContain('scamp.config.json');
    });
    it('rejects when the project has no pages', async () => {
        // Wipe the legacy scaffold's pages.
        await fs.rm(path.join(projectDir, 'home.tsx'));
        await fs.rm(path.join(projectDir, 'home.module.css'));
        await expect(migrateLegacyToNextjs(projectDir)).rejects.toThrow(/No pages found/);
    });
});
