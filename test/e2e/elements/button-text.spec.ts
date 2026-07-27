import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * `<button>` is text-capable: a text element retagged to <button> emits
 * `<button>…</button>` and stays an editable text element (not a
 * container), so its label round-trips through the canvas.
 */
test.describe('elements: button as text', () => {
  test('a text element retagged to <button> stays editable text', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 't');
    await dragInFrame(window, { x: 150, y: 150 }, { x: 152, y: 152 });
    await window.keyboard.press('Escape');

    const text = canvasElementsByPrefix(window, 'text_').first();
    await text.waitFor();
    const className = await text.getAttribute('data-scamp-id');
    if (!className) throw new Error('text element missing class');

    // Retag to <button> via the Element tag dropdown (button is a valid
    // text-element tag now).
    const tagSelect = panelSection(window, 'Element').locator('select').first();
    await tagSelect.selectOption('button');
    await waitForSaved(window);

    const { tsx } = await readPageFiles(project.dir, project.pageName);
    // Emitted as a <button> carrying the text element's id...
    expect(tsx).toMatch(new RegExp(`<button[^>]*data-scamp-id="${className}"`));
    // ...and still a TEXT element — the Typography section only renders
    // for text-typed elements.
    await expect(panelSection(window, 'Typography')).toBeVisible();
  });
});
