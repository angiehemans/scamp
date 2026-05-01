import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The bottom code panel renders read-only CodeMirror views of the
 * active page's TSX + CSS. It's driven by `pageSource` in the canvas
 * store, which is kept fresh by the sync bridge — so whatever we can
 * see on disk is what the panel shows.
 */
test.describe('code output: live preview', () => {
    test('toggling the Code panel shows the active page source', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.getByRole('button', { name: /^Code\s/ }).click();
        // The panel's left pane is labelled `home.tsx` and contains the
        // default page skeleton.
        await expect(window.getByText('home.tsx', { exact: true })).toBeVisible();
        await expect(window.getByText('home.module.css', { exact: true })).toBeVisible();
    });
    test('drawing a rect updates the preview with the new class', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.getByRole('button', { name: /^Code\s/ }).click();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 120, y: 120 }, { x: 300, y: 250 });
        const className = await canvasElementsByPrefix(window, 'rect_')
            .first()
            .getAttribute('data-scamp-id');
        if (!className)
            throw new Error('no rect created');
        await waitForSaved(window);
        // CodeMirror renders its content as .cm-content — we don't depend on
        // that internal class, but the class name still ends up in the DOM
        // as visible text inside the editor.
        await expect(window.getByText(className, { exact: false }).first()).toBeVisible();
    });
});
