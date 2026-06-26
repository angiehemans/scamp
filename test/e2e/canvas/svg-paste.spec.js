import { test, expect } from '../fixtures/app';
import { canvasElementsByPrefix, canvasFrame, pageRoot, } from '../fixtures/selectors';
import { panelSection } from '../fixtures/panel';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * Paste an SVG copied as markup (Cmd/Ctrl+V) → inline editable <svg>
 * element. Drives the real OS clipboard via the Electron main process.
 * see docs/plans/svg-improvements-plan.md
 */
test.describe('canvas: paste SVG from clipboard', () => {
    test('pastes copied SVG markup as an inline svg element', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff0000"/></svg>');
        });
        // Neutral focus, then paste.
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'img_')).toHaveCount(1);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain('<svg');
        expect(tsx).toContain('<circle');
    });
    test('keeps a pasted shape as valid-JSX attributes, rendering its own color', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        await waitForSaved(window);
        // The shape keeps a plain presentation attribute — valid JSX, no inline
        // `style` strings (which crash Next.js) and no `var()` (which an SVG
        // attribute won't resolve). The rect itself is present and rendered.
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain('fill="#ff0000"');
        expect(tsx).not.toContain('var(');
        expect(tsx).not.toContain('style=');
        await expect(canvasElementsByPrefix(window, 'img_').first().locator('rect').first()).toHaveAttribute('fill', '#ff0000');
    });
    test('setting Fill in the SVG section recolors the shape', async ({ window, app, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        // The pasted svg is selected → the SVG section shows. Set Fill to blue.
        const fillInput = panelSection(window, 'SVG')
            .locator('input[type="text"]')
            .first();
        await fillInput.fill('#0000ff');
        await fillInput.press('Enter');
        const rect = canvasElementsByPrefix(window, 'img_')
            .first()
            .locator('rect')
            .first();
        await expect
            .poll(async () => rect.evaluate((el) => getComputedStyle(el).fill))
            .toBe('rgb(0, 0, 255)');
    });
    test('an outline icon: invisible box dropped, strokes recolor via Stroke', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Lucide/Tabler shape: a transparent bounding box (fill="none"
        // stroke="none") plus a stroked path, with the paint on the root.
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 0h24v24H0z" fill="none" stroke="none"/><path d="M4 6h16"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        await waitForSaved(window);
        // The fully-transparent bounding box is dropped on import (so an
        // element-level colour can never paint it as a solid square); the
        // stroked path remains. Source stays valid JSX (no var/style).
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).not.toContain('M0 0h24v24H0z');
        expect(tsx).toContain('M4 6h16');
        expect(tsx).not.toContain('var(');
        expect(tsx).not.toContain('style=');
        // Set Stroke to blue → the stroked path recolours via the wrapper.
        const strokeInput = panelSection(window, 'SVG')
            .locator('input[type="text"]')
            .nth(1);
        await strokeInput.fill('#0000ff');
        await strokeInput.press('Enter');
        const strokePath = canvasElementsByPrefix(window, 'img_')
            .first()
            .locator('path')
            .first();
        await expect
            .poll(async () => strokePath.evaluate((el) => getComputedStyle(el).stroke))
            .toBe('rgb(0, 0, 255)');
    });
    test('recolors via a theme TOKEN (resolved on the canvas)', async ({ window, app, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        // Open the Stroke colour picker (2nd in the SVG section), Tokens tab,
        // pick --color-primary (#3b82f6).
        await panelSection(window, 'SVG')
            .getByRole('button', { name: 'Pick color' })
            .nth(1)
            .click();
        await window.getByRole('button', { name: 'Tokens', exact: true }).click();
        await window.getByRole('button', { name: /^--color-primary/ }).click();
        // The token resolves to its value on the canvas (elementToStyle reads
        // the same themeTokens), and the path inherits it.
        const path = canvasElementsByPrefix(window, 'img_')
            .first()
            .locator('path')
            .first();
        await expect
            .poll(async () => path.evaluate((el) => getComputedStyle(el).stroke))
            .toBe('rgb(59, 130, 246)');
    });
    test('sanitizes <script> out of pasted svg', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain('<rect');
        expect(tsx.toLowerCase()).not.toContain('<script');
    });
});
