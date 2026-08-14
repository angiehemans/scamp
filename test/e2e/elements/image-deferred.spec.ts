import { promises as fs } from 'fs';
import path from 'path';

import { test, expect, stubOpenDialog, writeFixtureImageOutside } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * A large import is placed immediately from the copied original and
 * swapped to the compressed .webp when the encode finishes, so the
 * canvas doesn't sit empty for seconds.
 *
 * This is the only level that proves the whole loop: the deferred copy,
 * the background convert, the main→renderer event, the silent reference
 * swap, and main deleting the file that's no longer referenced.
 * see docs/plans/image-import-speed-plan.md
 */

const assetsDir = (projectDir: string): string => path.join(projectDir, 'assets');

const assetNames = async (projectDir: string): Promise<string[]> =>
  (await fs.readdir(assetsDir(projectDir)).catch(() => [] as string[])).sort();

test.describe('images: deferred conversion', () => {
  test('places the original, then swaps to the webp and cleans up', async ({
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

    const outside = await writeFixtureImageOutside('hero.png');
    await stubOpenDialog(app, outside);

    const background = panelSection(window, 'Background');
    await background.getByRole('button', { name: 'Set background image' }).click();
    await expect(
      background.getByRole('button', { name: 'Replace image' })
    ).toBeVisible();

    // The conversion lands asynchronously: the folder ends up holding
    // only the webp, and the CSS points at it.
    await expect.poll(() => assetNames(project.dir), { timeout: 20000 }).toEqual([
      'hero.webp',
    ]);

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
    expect(block).toContain('hero.webp');
    expect(block).not.toContain('hero.png');
  });

  test('the swap does not add an undo step', async ({ window, app, project }) => {
    // The user didn't perform the swap, and undoing to a path that has
    // just been deleted would leave a broken image.
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
    await waitForSaved(window);

    const outside = await writeFixtureImageOutside('hero.png');
    await stubOpenDialog(app, outside);
    const background = panelSection(window, 'Background');
    await background.getByRole('button', { name: 'Set background image' }).click();
    await expect(
      background.getByRole('button', { name: 'Replace image' })
    ).toBeVisible();
    await expect.poll(() => assetNames(project.dir), { timeout: 20000 }).toEqual([
      'hero.webp',
    ]);
    await waitForSaved(window);

    // One undo returns to before the background was set, not to an
    // intermediate state pointing at the deleted original.
    await window.keyboard.press('ControlOrMeta+z');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).not.toContain('hero.png');
  });
});
