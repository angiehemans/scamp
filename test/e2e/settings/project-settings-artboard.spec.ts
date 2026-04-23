import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import {
  closeProjectSettings,
  openProjectSettings,
} from '../fixtures/breakpoints';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles } from '../fixtures/assertions';

test.describe('settings: artboard background', () => {
  test('artboard color lives in scamp.config.json, not in the page CSS', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await openProjectSettings(window);

    // The first color text input on the page is the artboard swatch.
    const colorInput = window
      .locator('h2', { hasText: 'General' })
      .locator('..')
      .locator('input[type="text"]')
      .first();
    await colorInput.click({ clickCount: 3 });
    await colorInput.fill('#abcdef');
    await colorInput.press('Enter');

    // Wait for the color to land in scamp.config.json.
    await expect
      .poll(
        async () =>
          fs.readFile(path.join(project.dir, 'scamp.config.json'), 'utf-8'),
        { timeout: 5_000 }
      )
      .toContain('#abcdef');

    await closeProjectSettings(window);

    // The page's CSS module never references the chosen color — it's
    // a canvas-only preference, never generated into user CSS.
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).not.toContain('#abcdef');
    expect(css).not.toContain('abcdef');
  });
});
