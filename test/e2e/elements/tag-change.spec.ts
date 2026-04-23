import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('elements: tag change', () => {
  test('changing a rect to <nav> writes <nav> in the TSX; class prefix stays rect_', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const tagSelect = panelSection(window, 'Element').locator('select').first();
    await tagSelect.selectOption('nav');

    await waitForSaved(window);
    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toMatch(new RegExp(`<nav[^>]*data-scamp-id="${className}"`));
    // Class prefix is still rect_ — the tag change doesn't rewrite it.
    expect(className).toMatch(/^rect_/);
  });

  test('changing a text element to <h1> writes <h1>', async ({
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
    // The text element is already selected after creation — no extra
    // click needed (and the canvas interaction layer would intercept
    // it anyway).

    const tagSelect = panelSection(window, 'Element').locator('select').first();
    await tagSelect.selectOption('h1');

    await waitForSaved(window);
    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toMatch(new RegExp(`<h1[^>]*data-scamp-id="${className}"`));
  });
});
