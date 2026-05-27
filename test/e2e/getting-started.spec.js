import { test, expect } from './fixtures/app';
import { pageRoot } from './fixtures/selectors';
import { projectFileExists, readPageFiles } from './fixtures/assertions';
/**
 * Phase-1 smoke spec. Proves the harness can:
 *   - launch the built Electron app,
 *   - auto-open a seeded project via SCAMP_E2E_OPEN_PROJECT,
 *   - render the canvas (the page root appears in the DOM),
 *   - read the on-disk files that make up the project.
 *
 * Fuller coverage of getting-started flows (Start Screen UI, New
 * Project modal, recent projects list) lands in Phase 2+.
 */
test.describe('harness smoke', () => {
    test('auto-opens a seeded project and renders the page root', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        expect(await projectFileExists(project.dir, 'home.tsx')).toBe(true);
        expect(await projectFileExists(project.dir, 'home.module.css')).toBe(true);
        expect(await projectFileExists(project.dir, 'theme.css')).toBe(true);
        expect(await projectFileExists(project.dir, 'agent.md')).toBe(true);
    });
    test('backfills scamp.config.json on open', async ({ window, project }) => {
        // openProject() runs ensureProjectConfig() which writes the default
        // config if missing. By the time the page root is visible, the main
        // process has finished the open flow.
        await expect(pageRoot(window)).toBeVisible();
        expect(await projectFileExists(project.dir, 'scamp.config.json')).toBe(true);
    });
    test('generated home files contain the root class', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain('data-scamp-id="root"');
        expect(css).toContain('.root');
    });
});
