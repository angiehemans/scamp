import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('canvas: draw rectangle', () => {
  test('R + drag creates a rect on the canvas and on disk', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await selectTool(window, 'r');
    await dragInFrame(window, { x: 120, y: 140 }, { x: 360, y: 320 });

    const rect = canvasElementsByPrefix(window, 'rect_').first();
    await expect(rect).toBeVisible();
    const className = await rect.getAttribute('data-scamp-id');
    expect(className).toMatch(/^rect_[a-z0-9]+$/);

    await waitForSaved(window);
    const { tsx, css } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toContain(`data-scamp-id="${className}"`);
    // Drew a 240×180 rect, so CSS should record those dimensions.
    expect(css).toContain(`.${className}`);
    expect(css).toMatch(/width:\s*240px/);
    expect(css).toMatch(/height:\s*180px/);
    // A drawn rect is non-default in size, so position is written too.
    expect(css).toMatch(/left:\s*120px/);
    expect(css).toMatch(/top:\s*140px/);
  });

  test('R + click drops a default-sized rect centered on the cursor', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await selectTool(window, 'r');
    // A drag shorter than CLICK_DRAG_THRESHOLD collapses to a click —
    // the handler substitutes a 200×200 rect centered at startX/startY.
    await dragInFrame(window, { x: 300, y: 300 }, { x: 302, y: 302 });

    const rect = canvasElementsByPrefix(window, 'rect_').first();
    await expect(rect).toBeVisible();

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(/width:\s*200px/);
    expect(css).toMatch(/height:\s*200px/);
  });

  test('after drawing, tool reverts to select', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 120, y: 140 }, { x: 360, y: 320 });

    // Selection handles should appear — confirms we've switched to the
    // select tool and the new rect is selected.
    await expect(window.locator('[data-handle="se"]')).toBeVisible();
  });
});
