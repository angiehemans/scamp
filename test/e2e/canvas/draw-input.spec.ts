import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('canvas: draw input', () => {
  test('F + drag creates an <input> on the canvas and on disk', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await selectTool(window, 'f');
    await dragInFrame(window, { x: 100, y: 200 }, { x: 340, y: 240 });

    const input = canvasElementsByPrefix(window, 'input_').first();
    await expect(input).toBeVisible();
    const className = await input.getAttribute('data-scamp-id');
    expect(className).toMatch(/^input_[a-z0-9]+$/);

    await waitForSaved(window);
    const { tsx, css } = await readPageFiles(project.dir, project.pageName);
    // Default input tag is `<input>` — a void element.
    expect(tsx).toMatch(new RegExp(`<input[^>]*data-scamp-id="${className}"`));
    expect(css).toContain(`.${className}`);
    expect(css).toMatch(/width:\s*240px/);
    expect(css).toMatch(/height:\s*40px/);
  });
});
