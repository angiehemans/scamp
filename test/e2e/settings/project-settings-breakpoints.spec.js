import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { closeProjectSettings, openProjectSettings, } from '../fixtures/breakpoints';
import { pageRoot } from '../fixtures/selectors';
const readConfig = async (projectDir) => {
    const raw = await fs.readFile(path.join(projectDir, 'scamp.config.json'), 'utf-8');
    return JSON.parse(raw);
};
test.describe('settings: project breakpoints editor', () => {
    test('adding a breakpoint writes it to scamp.config.json and list stays widest-first', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await openProjectSettings(window);
        await window.getByRole('button', { name: '+ Add breakpoint' }).click();
        // Poll the config file — the onChange handler writes it
        // synchronously via the project-config IPC.
        await expect
            .poll(async () => (await readConfig(project.dir)).breakpoints.length, {
            timeout: 5_000,
        })
            .toBe(4);
        const config = await readConfig(project.dir);
        // Widest-first ordering — Desktop (1440) comes first, Mobile (390) last.
        const widths = config.breakpoints.map((b) => b.width);
        expect(widths).toEqual([...widths].sort((a, b) => b - a));
        expect(widths[0]).toBe(1440);
        await closeProjectSettings(window);
    });
    test('Desktop breakpoint remove button is disabled', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await openProjectSettings(window);
        // Desktop's remove button carries a "(disabled)" suffix on the
        // aria-label; non-desktop rows don't.
        await expect(window.getByRole('button', { name: /^Remove Desktop \(disabled\)/ })).toBeDisabled();
    });
    test('removing a non-desktop breakpoint shrinks the list', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await openProjectSettings(window);
        await window.getByRole('button', { name: 'Remove Mobile' }).click();
        await expect
            .poll(async () => (await readConfig(project.dir)).breakpoints.length, {
            timeout: 5_000,
        })
            .toBe(2);
        const config = await readConfig(project.dir);
        expect(config.breakpoints.map((b) => b.id)).not.toContain('mobile');
        expect(config.breakpoints.map((b) => b.id)).toContain('desktop');
    });
});
