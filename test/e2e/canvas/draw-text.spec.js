import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('canvas: draw text', () => {
    test('T + click places a default <p> text element', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 't');
        await clickInFrame(window, { x: 150, y: 160 });
        // Text creation leaves the element in edit mode — commit by clicking
        // away so the write settles.
        await window.keyboard.press('Escape');
        await clickInFrame(window, { x: 800, y: 800 });
        const text = canvasElementsByPrefix(window, 'text_').first();
        await expect(text).toBeVisible();
        const className = await text.getAttribute('data-scamp-id');
        expect(className).toMatch(/^text_[a-z0-9]+$/);
        await waitForSaved(window);
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        // Default text tag is `<p>`.
        expect(tsx).toMatch(new RegExp(`<p[^>]*data-scamp-id="${className}"`));
        expect(css).toContain(`.${className}`);
    });
});
