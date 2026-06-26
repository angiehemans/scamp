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
    test('rewrites shape paint to a var and resolves it on the canvas', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        await waitForSaved(window);
        // The shape's hardcoded fill is rewritten to var(--svg-fill, #ff0000)
        // in the stored source...
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain('var(--svg-fill, #ff0000)');
        // ...and with no override set yet, real Chromium resolves the var to
        // the original red — proving it survives sanitize + render and that
        // setting --svg-fill (the SvgSection's job) would recolour it.
        const rect = canvasElementsByPrefix(window, 'img_')
            .first()
            .locator('rect')
            .first();
        const fill = await rect.evaluate((el) => getComputedStyle(el).fill);
        expect(fill).toBe('rgb(255, 0, 0)');
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
    test('an outline icon: transparent box stays unpainted, strokes recolor', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Lucide/Tabler shape: a transparent bounding box (fill="none") plus a
        // stroked path, with the paint on the root.
        await app.evaluate(({ clipboard }) => {
            clipboard.writeText('<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M0 0h24v24H0z" fill="none" stroke="none"/><path d="M4 6h16"/></svg>');
        });
        await canvasFrame(window).click({ position: { x: 4, y: 4 } });
        await window.keyboard.press('ControlOrMeta+v');
        await waitForSaved(window);
        // The bounding box keeps a real fill="none" attribute — NOT rewritten
        // into a var() that an element-level colour could fill (the bug). The
        // stroked path is var-ified so it can recolour.
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toMatch(/<path[^>]*\bfill="none"/);
        expect(tsx).toContain('var(--svg-stroke');
        // Set Stroke to blue → the stroked path recolours via --svg-stroke.
        const strokeInput = panelSection(window, 'SVG')
            .locator('input[type="text"]')
            .nth(1);
        await strokeInput.fill('#0000ff');
        await strokeInput.press('Enter');
        const paths = canvasElementsByPrefix(window, 'img_').first().locator('path');
        await expect
            .poll(async () => paths.nth(1).evaluate((el) => getComputedStyle(el).stroke))
            .toBe('rgb(0, 0, 255)');
        // The transparent box never became a coloured square — its fill
        // attribute is untouched.
        expect(await paths.nth(0).evaluate((el) => el.getAttribute('fill'))).toBe('none');
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
