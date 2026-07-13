import { test, expect } from '../fixtures/app';
import { setClipContent } from '../fixtures/breakpoints';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot, resizeHandle } from '../fixtures/selectors';

/**
 * Regression guard: with clip on, the canvas boundary overlay renders
 * (for the natural-height rule). It's a full-cover element, so if it
 * ever regains `pointer-events: auto` it silently eats every canvas
 * click and you can't draw / select / move anything. This asserts the
 * canvas stays interactive while the overlay is present.
 */
test.describe('canvas interaction with clip on', () => {
  test('can draw and select an element while clip is on', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();

    await setClipContent(window, true);

    await selectTool(window, 'r');
    await dragInFrame(window, { x: 120, y: 120 }, { x: 320, y: 260 });

    // A freshly drawn rectangle is auto-selected; its resize handles
    // only render for a live single selection — so their presence proves
    // the draw+select gesture reached the interaction layer.
    await expect(resizeHandle(window, 'se')).toBeVisible();
  });
});
