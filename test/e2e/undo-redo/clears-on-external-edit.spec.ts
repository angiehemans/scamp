import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.describe('undo / redo: cleared by external file edit', () => {
  test('external CSS write wipes the undo stack', async ({ window, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 220, y: 180 }
    );
    await waitForSaved(window);

    // Open the code panel so we have an observable signal for when
    // the sync bridge finishes reparsing the external edit.
    await window.getByRole('button', { name: /^Code\s/ }).click();

    // Rewrite the CSS externally — the sync bridge calls
    // temporal.clear() as part of reloadElements().
    const cssPath = path.join(project.dir, 'home.module.css');
    const original = await fs.readFile(cssPath, 'utf-8');
    const edited = original.replace(
      new RegExp(`(\\.${className}\\s*\\{[^}]*width:\\s*)\\d+px`),
      '$1333px'
    );
    expect(edited).not.toBe(original);
    await fs.writeFile(cssPath, edited, 'utf-8');

    // Wait for the external change to land in the code panel (proxy
    // for "sync bridge has processed it and called temporal.clear()").
    await expect(window.getByText(/width:\s*333px/).first()).toBeVisible({
      timeout: 10_000,
    });

    // Attempt to undo — should be a no-op since history was cleared.
    await window.keyboard.press('ControlOrMeta+z');
    await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
  });
});
