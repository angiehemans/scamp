import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import {
  clickContextMenuItem,
  openElementContextMenu,
} from '../fixtures/components';
import { frameToClient, measureFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * The element right-click menu's "Delete contents" empties an element —
 * removing its children — without removing the element itself.
 */
test.describe('elements: delete contents', () => {
  test('removes the children but keeps the parent element', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // A parent rect with a child drawn inside it.
    const parentClass = await drawAndSelectRect(
      window,
      { x: 60, y: 60 },
      { x: 400, y: 300 }
    );
    await waitForSaved(window);
    const childClass = await drawAndSelectRect(
      window,
      { x: 90, y: 90 },
      { x: 180, y: 160 }
    );
    await waitForSaved(window);
    expect(childClass).not.toBe(parentClass);

    // Sanity: both elements are on the page and the child is nested.
    const before = await readPageFiles(project.dir, project.pageName);
    expect(before.tsx).toContain(parentClass);
    expect(before.tsx).toContain(childClass);

    // Right-click a part of the parent NOT covered by the child, then
    // pick "Delete contents". (Select tool so the right-click hit-tests
    // instead of starting a draw.)
    await selectTool(window, 'v');
    const metrics = await measureFrame(window);
    const point = frameToClient(metrics, { x: 320, y: 250 });
    await openElementContextMenu(window, point.x, point.y);
    await clickContextMenuItem(window, 'Delete contents');
    await waitForSaved(window);

    const after = await readPageFiles(project.dir, project.pageName);
    // Parent survives; the child is gone.
    expect(after.tsx).toContain(parentClass);
    expect(after.tsx).not.toContain(childClass);
    expect(after.css).not.toContain(childClass);
  });
});
