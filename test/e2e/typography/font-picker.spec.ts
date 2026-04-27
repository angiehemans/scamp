import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('typography: font picker', () => {
  test('picking a font commits a CSS font-family value', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 't');
    await clickInFrame(window, { x: 180, y: 180 });
    await window.keyboard.press('Escape');
    const text = canvasElementsByPrefix(window, 'text_').first();
    await text.waitFor();
    const className = await text.getAttribute('data-scamp-id');
    if (!className) throw new Error('no text element');
    await waitForSaved(window);

    // Open the font picker — the trigger button reads "System font ▾".
    const typography = panelSection(window, 'Typography');
    await typography.getByRole('button', { name: /System font/ }).click();
    await window.getByPlaceholder('Search fonts…').waitFor();

    // The first row is "System font" (empty choice). ArrowDown + Enter
    // picks the next real row — keeps the spec environment-agnostic
    // since we don't care which font lands on disk, only that picking
    // one produces a non-empty font-family declaration.
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press('Enter');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*font-family:[^;]+;`, 's')
    );
  });

  test('custom-font escape hatch commits a typed name when no enumerated font matches', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 't');
    await clickInFrame(window, { x: 180, y: 180 });
    await window.keyboard.press('Escape');
    const text = canvasElementsByPrefix(window, 'text_').first();
    await text.waitFor();
    const className = await text.getAttribute('data-scamp-id');
    if (!className) throw new Error('no text element');
    await waitForSaved(window);

    const typography = panelSection(window, 'Typography');
    await typography.getByRole('button', { name: /System font/ }).click();
    const search = window.getByPlaceholder('Search fonts…');
    await search.waitFor();

    // A name Chromium's queryLocalFonts() definitely won't return —
    // simulating the user installing a font with quirky metadata
    // (e.g. TCA Thecoa Desktop 2). The picker should offer a
    // `Use "..."` row that lets the user commit anyway.
    await search.fill('FakeFontDoesNotExist 9000');
    await expect(
      window.getByRole('option', { name: /^Use "FakeFontDoesNotExist 9000"/ })
    ).toBeVisible();

    await search.press('Enter');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(
        `\\.${className}[^}]*font-family:[^;]*FakeFontDoesNotExist 9000`,
        's'
      )
    );
  });
});
