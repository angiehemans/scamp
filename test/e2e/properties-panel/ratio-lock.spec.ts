import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
  panelSection,
} from '../fixtures/panel';
import { pageRoot, resizeHandle } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

// Backlog-6 story 1: locked aspect-ratio resize. The lock is session-only
// UI state (never written to CSS), so it's asserted via the toggle's
// aria-pressed and via the paired-axis recompute in the generated CSS.

const sizeLockToggle = (window: import('@playwright/test').Page) =>
  panelSection(window, 'Size').getByRole('button', {
    name: /Lock ratio|Ratio locked/,
  });

test.describe('properties panel: aspect-ratio lock', () => {
  test('locking then changing width recomputes height to hold the ratio', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 300, y: 220 }
    );
    // Establish a clean 2:1 ratio explicitly so the recompute is
    // deterministic regardless of the exact drawn pixel size.
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '400');
    await commitInput(panelInputByPrefix(window, 'Size', 'H'), '200');
    await waitForSaved(window);

    const lock = sizeLockToggle(window);
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');

    // New width 300 → height = round(300 / 2) = 150.
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '300');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*300px`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*150px`, 's'));
  });

  test('switching an axis to stretch auto-releases the lock', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 300, y: 220 });
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '400');
    await commitInput(panelInputByPrefix(window, 'Size', 'H'), '200');

    const lock = sizeLockToggle(window);
    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');

    // Width → Stretch (percentage) can't be ratio-locked against a fixed
    // height, so the lock drops automatically.
    await panelSection(window, 'Size')
      .locator('select')
      .first()
      .selectOption('stretch');
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
  });

  test('locking disables the edge resize handles, leaving only corners', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 300, y: 220 });

    // Before locking: a plain element exposes edge handles.
    await expect(resizeHandle(window, 'e')).toHaveCount(1);

    await sizeLockToggle(window).click();

    // After locking: edge handles are gone, corner handles remain, so a
    // drag can only scale proportionally from a corner.
    await expect(resizeHandle(window, 'e')).toHaveCount(0);
    await expect(resizeHandle(window, 'se')).toHaveCount(1);
  });
});
