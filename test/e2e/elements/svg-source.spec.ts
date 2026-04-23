import { test, expect } from '../fixtures/app';
import { stubOpenDialog, writeFixtureImage } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * Creates an image element via the file-dialog-stubbed image tool, then
 * swaps its tag to `<svg>` and writes inner source. The canvas renders
 * svg as a placeholder rect (see ElementRenderer.canvasRenderTag) but
 * the TSX on disk must carry the source byte-for-byte.
 */
test.describe('elements: svg source', () => {
  test('switching an image to <svg> and typing source writes source verbatim', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    const pngPath = await writeFixtureImage(project.dir);
    await stubOpenDialog(app, pngPath);

    await selectTool(window, 'i');
    // File-dialog stub returns immediately; draw the frame now.
    await dragInFrame(window, { x: 100, y: 100 }, { x: 260, y: 240 });
    const img = canvasElementsByPrefix(window, 'img_').first();
    const className = await img.getAttribute('data-scamp-id');
    if (!className) throw new Error('no img created');

    // Swap tag to svg.
    const section = panelSection(window, 'Element');
    await section.locator('select').first().selectOption('svg');

    // Type inner SVG source in the Source textarea.
    const svgSource = '<circle cx="50" cy="50" r="40" fill="currentColor" />';
    const textarea = section.locator('textarea').first();
    await textarea.fill(svgSource);
    // Textarea onChange writes immediately; blur to debounce the write.
    await textarea.blur();

    await waitForSaved(window);
    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toMatch(new RegExp(`<svg[^>]*data-scamp-id="${className}"`));
    expect(tsx).toContain(svgSource);
  });
});
