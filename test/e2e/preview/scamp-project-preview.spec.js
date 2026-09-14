import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
/**
 * Phase 3's exit: a new project on the Scamp framework, created behind
 * the flag, previews through `scamp dev`. The framework comes from the
 * repo's devDependency, linked into the project instead of installed, so
 * the test needs no network. see docs/plans/framework-phase-3-plan.md
 */
const REPO_MODULES = path.resolve(__dirname, '../../../node_modules');
test.describe('a flagged Scamp-framework project', () => {
    let parent;
    test.beforeEach(async () => {
        parent = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-framework-'));
    });
    test.afterEach(async () => {
        await fs.rm(parent, { recursive: true, force: true });
    });
    test('scaffolds from scampjs/templates and previews a view at /_views/<Name>', async ({ window, app, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const created = (await window.evaluate(({ parentPath }) => window.scamp.createProject({ parentPath, name: 'framework-app', format: 'scamp' }), { parentPath: parent }));
        const dir = path.join(parent, 'framework-app');
        expect(created.format).toBe('scamp');
        expect(created.pages).toEqual([]);
        expect(created.components.map((c) => [c.name, c.kind])).toEqual([['Home', 'view']]);
        for (const file of [
            'views/Home/Home.tsx',
            'views/Home/Home.module.css',
            'routes/index.tsx',
            'design/theme.css',
            'scamp-env.d.ts',
            'tsconfig.json',
            'scamp.config.json',
        ]) {
            await expect(fs.access(path.join(dir, file)), file).resolves.toBeUndefined();
        }
        const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'));
        expect(pkg.scripts['dev']).toBe('scamp dev');
        expect(Object.keys(pkg.dependencies).sort()).toEqual(['preact', 'scampjs']);
        // The view is the empty form at the contract this build writes.
        expect(await fs.readFile(path.join(dir, 'views/Home/Home.tsx'), 'utf-8')).toContain('export const _scamp = { contract: 1, events: [] } as const;');
        // Stand in for `npm install`: link the framework and preact the repo
        // already has. The first preview would otherwise install for real.
        await fs.mkdir(path.join(dir, 'node_modules'), { recursive: true });
        for (const name of ['scampjs', 'preact']) {
            await fs.symlink(path.join(REPO_MODULES, name), path.join(dir, 'node_modules', name), 'dir');
        }
        const windowsBefore = app.windows().length;
        await window.evaluate(({ projectPath }) => window.scamp.openPreview({
            projectPath,
            pageName: 'home',
            pageNames: ['home'],
            routes: { home: '/_views/Home' },
        }), { projectPath: dir });
        await expect.poll(() => app.windows().length, { timeout: 15_000 }).toBeGreaterThan(windowsBefore);
        const preview = app.windows().find((w) => w.url().includes('preview'));
        if (preview === undefined)
            throw new Error('no preview window opened');
        let status = { kind: 'idle' };
        await expect
            .poll(async () => {
            status = (await preview.evaluate(({ projectPath }) => window.scampPreview.getStatus(projectPath), { projectPath: dir }));
            return status.kind;
        }, { timeout: 60_000, message: 'scamp dev becomes ready' })
            .toBe('ready');
        const port = status.port ?? 0;
        expect(port).toBeGreaterThan(0);
        const res = await fetch(`http://127.0.0.1:${port}/_views/Home`);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('data-scamp-id="root"');
        expect(html).toContain('--color-primary');
        expect(JSON.parse(await (await fetch(`http://127.0.0.1:${port}/_views/`)).text())).toEqual({
            views: ['Home'],
        });
        // The preview window navigated its webview to the view, not to `/`.
        await expect(preview.getByText('/_views/Home')).toBeVisible({ timeout: 15_000 });
        await window.evaluate(({ projectPath }) => window.scamp.closePreview(projectPath), {
            projectPath: dir,
        });
    });
    test('is refused without the flag', async ({ window, app }) => {
        await expect(pageRoot(window)).toBeVisible();
        // The e2e launcher sets the flag; clear it in main for this check.
        await app.evaluate(() => {
            delete process.env['SCAMP_FRAMEWORK_PROJECTS'];
        });
        const error = await window.evaluate(async ({ parentPath }) => {
            try {
                await window.scamp.createProject({ parentPath, name: 'nope', format: 'scamp' });
                return null;
            }
            catch (e) {
                return e instanceof Error ? e.message : String(e);
            }
        }, { parentPath: parent });
        expect(error).toContain('not enabled');
        await app.evaluate(() => {
            process.env['SCAMP_FRAMEWORK_PROJECTS'] = '1';
        });
    });
});
