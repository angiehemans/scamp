import { test, expect } from '../fixtures/app';
import { clickInFrame, dragInFrame, selectTool } from '../fixtures/canvas';
import { codeToggle, pageRoot } from '../fixtures/selectors';

/**
 * Selecting an element highlights its lines in both code panes.
 *
 * `codeHighlight` unit tests cover WHICH lines; this covers whether the
 * decoration actually reaches the DOM — the CodeMirror StateField plumbing
 * is the part that can silently do nothing.
 */

test.use({ projectOptions: { format: 'nextjs' } });

/**
 * Lines CodeMirror has marked as the selected element's.
 *
 * Panes are addressed by `data-pane`: a class-substring selector also
 * matches `paneHeader`, which silently picks the wrong element.
 */
const highlighted = (
  window: Parameters<typeof selectTool>[0],
  pane: 'tsx' | 'css'
) =>
  window.locator(`[data-pane="${pane}"] [class*="highlightLine"]`);

test.describe('code panel: selection highlight', () => {
  test('highlights the selected element in both panes', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 240, y: 180 });
    await codeToggle(window).click();

    // One JSX line for the element, and its CSS rule block.
    await expect(highlighted(window, 'tsx')).toHaveCount(1);
    expect(await highlighted(window, 'css').count()).toBeGreaterThan(1);
  });

  test('the highlighted TSX line is the element own tag', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 240, y: 180 });
    await codeToggle(window).click();

    const text = await highlighted(window, 'tsx').first().innerText();
    expect(text).toContain('data-scamp-id="rect_');
  });

  test('the highlighted CSS starts at the element rule', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 240, y: 180 });
    await codeToggle(window).click();

    const text = await highlighted(window, 'css').first().innerText();
    expect(text).toContain('.rect_');
  });

  test('follows the selection to another element', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 160, y: 140 });
    await codeToggle(window).click();
    const first = await highlighted(window, 'tsx').first().innerText();

    await selectTool(window, 'r');
    await dragInFrame(window, { x: 220, y: 60 }, { x: 340, y: 160 });
    await expect(highlighted(window, 'tsx')).toHaveCount(1);
    const second = await highlighted(window, 'tsx').first().innerText();

    expect(second).not.toBe(first);
    expect(second).toContain('data-scamp-id="rect_');
  });

  test('moves to the page root when the background is clicked', async ({
    window,
  }) => {
    // There is no "nothing selected" state to test: clicking bare canvas
    // selects the root, and Escape exits the component editor rather than
    // deselecting. So the meaningful assertion is that the highlight
    // follows, and does not stay stuck on the previous element.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 200, y: 160 });
    await codeToggle(window).click();
    await expect(highlighted(window, 'tsx')).toHaveCount(1);

    await selectTool(window, 'v');
    await clickInFrame(window, { x: 420, y: 320 });

    await expect(highlighted(window, 'tsx')).toHaveCount(1);
    const text = await highlighted(window, 'tsx').first().innerText();
    expect(text).toContain('data-scamp-id="root"');
  });
});
