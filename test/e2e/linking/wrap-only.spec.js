import { test, expect, stubOpenDialog, writeFixtureImage } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * For elements that can't accept children-as-href semantics
 * (`<img>`, `<video>`, `<iframe>`, `<svg>`, `<input>`, `<textarea>`,
 * `<select>`), picking a link destination wraps the element in a new
 * `<a>` parent rather than swapping its tag.
 */
test.describe('linking: wrap-only routing', () => {
    test('linking an <img> wraps it in a new <a> parent', async ({ window, app, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Place an image so the selected element has tag `img`.
        const fixturePath = await writeFixtureImage(project.dir, 'pixel.png');
        await stubOpenDialog(app, fixturePath);
        await selectTool(window, 'i');
        await clickInFrame(window, { x: 200, y: 200 });
        const img = canvasElementsByPrefix(window, 'img_').first();
        await expect(img).toBeVisible({ timeout: 10_000 });
        const imgClass = await img.getAttribute('data-scamp-id');
        expect(imgClass).toBeTruthy();
        await waitForSaved(window);
        // Set link destination to Page — for an img this wraps in <a>.
        const elementSection = panelSection(window, 'Element');
        await elementSection.locator('select').nth(1).selectOption('page');
        await waitForSaved(window);
        const { tsx } = await readPageFiles(project.dir, project.pageName);
        // The original img stays as <img> with its original class; an <a>
        // wrapper appears around it. The wrapper's data-scamp-id is a
        // freshly-allocated `rect_` (or similar) class — we don't pin its
        // exact name, just the structural shape: <a ...><img ...></a>.
        const wrappedPattern = new RegExp(`<a [^>]*href="/"[^>]*>\\s*<img [^>]*data-scamp-id="${imgClass}"`, 's');
        expect(tsx).toMatch(wrappedPattern);
    });
});
