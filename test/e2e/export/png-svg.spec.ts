import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect, stubSaveDialog } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * The Export section sits at the bottom of the WYSIWYG panel and
 * writes a PNG or SVG of the selected element (or the page when
 * nothing is selected) through the main-process IPC. The save dialog
 * is stubbed so the test runs deterministically.
 */
test.describe('export: PNG / SVG', () => {
  test('Export PNG writes a real PNG file (signature bytes match)', async ({
    window,
    app,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const outPath = path.join(project.dir, 'export.png');
    await stubSaveDialog(app, outPath);

    // Format defaults to PNG; click the scope-aware Export button.
    const exportSection = panelSection(window, 'Export');
    await exportSection
      .getByRole('button', { name: new RegExp(`Export ${className}`) })
      .click();

    // Wait for the file to land on disk (the renderer captures, IPCs
    // to main, main writes the buffer).
    await expect
      .poll(async () => {
        try {
          const stat = await fs.stat(outPath);
          return stat.size > 0;
        } catch {
          return false;
        }
      }, { timeout: 15_000 })
      .toBe(true);

    // PNG file signature: 89 50 4e 47 0d 0a 1a 0a
    const buf = await fs.readFile(outPath);
    expect(buf.length).toBeGreaterThan(8);
    expect(Array.from(buf.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  test('Export SVG writes valid SVG XML', async ({ window, app, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    const outPath = path.join(project.dir, 'export.svg');
    await stubSaveDialog(app, outPath);

    // Switch the Format dropdown to SVG.
    const exportSection = panelSection(window, 'Export');
    await exportSection.locator('select').first().selectOption('svg');

    await exportSection
      .getByRole('button', { name: new RegExp(`Export ${className}`) })
      .click();

    await expect
      .poll(async () => {
        try {
          const stat = await fs.stat(outPath);
          return stat.size > 0;
        } catch {
          return false;
        }
      }, { timeout: 15_000 })
      .toBe(true);

    // SVG output starts with `<svg` (after optional XML declaration).
    const text = await fs.readFile(outPath, 'utf-8');
    expect(text).toContain('<svg');
    // And it should be real SVG, not a `data:image/svg+xml,...` URL.
    expect(text).not.toMatch(/^data:/);
  });
});
