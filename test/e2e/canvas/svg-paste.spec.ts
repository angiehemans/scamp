import { test, expect } from '../fixtures/app';
import {
  canvasElementsByPrefix,
  canvasFrame,
  pageRoot,
} from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * Paste an SVG copied as markup (Cmd/Ctrl+V) → inline editable <svg>
 * element. Drives the real OS clipboard via the Electron main process.
 * see docs/plans/svg-improvements-plan.md
 */
test.describe('canvas: paste SVG from clipboard', () => {
  test('pastes copied SVG markup as an inline svg element', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await app.evaluate(({ clipboard }) => {
      clipboard.writeText(
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff0000"/></svg>'
      );
    });

    // Neutral focus, then paste.
    await canvasFrame(window).click({ position: { x: 4, y: 4 } });
    await window.keyboard.press('ControlOrMeta+v');
    await waitForSaved(window);

    await expect(canvasElementsByPrefix(window, 'img_')).toHaveCount(1);
    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toContain('<svg');
    expect(tsx).toContain('<circle');
  });

  test('sanitizes <script> out of pasted svg', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await app.evaluate(({ clipboard }) => {
      clipboard.writeText(
        '<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>'
      );
    });

    await canvasFrame(window).click({ position: { x: 4, y: 4 } });
    await window.keyboard.press('ControlOrMeta+v');
    await waitForSaved(window);

    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toContain('<rect');
    expect(tsx.toLowerCase()).not.toContain('<script');
  });
});
