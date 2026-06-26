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

  test('rewrites shape paint to a var and resolves it on the canvas', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await app.evaluate(({ clipboard }) => {
      clipboard.writeText(
        '<svg viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>'
      );
    });

    await canvasFrame(window).click({ position: { x: 4, y: 4 } });
    await window.keyboard.press('ControlOrMeta+v');
    await waitForSaved(window);

    // The shape's hardcoded fill is rewritten to var(--svg-fill, #ff0000)
    // in the stored source...
    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toContain('var(--svg-fill, #ff0000)');

    // ...and with no override set yet, real Chromium resolves the var to
    // the original red — proving it survives sanitize + render and that
    // setting --svg-fill (the SvgSection's job) would recolour it.
    const rect = canvasElementsByPrefix(window, 'img_')
      .first()
      .locator('rect')
      .first();
    const fill = await rect.evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe('rgb(255, 0, 0)');
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
