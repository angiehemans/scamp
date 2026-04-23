import { promises as fs } from 'fs';
import * as path from 'path';

import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

const readTheme = (projectDir: string): Promise<string> =>
  fs.readFile(path.join(projectDir, 'theme.css'), 'utf-8');

test.describe('themes: panel CRUD', () => {
  test('opening the panel lists the seeded tokens', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    // Toolbar "Theme" button opens the panel.
    await window.getByRole('button', { name: /^Theme/ }).click();

    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();
    // The seeded theme.css ships with --color-primary, --color-secondary,
    // --color-background, --color-surface, --color-text, --color-muted.
    for (const name of [
      '--color-primary',
      '--color-secondary',
      '--color-text',
      '--color-muted',
    ]) {
      await expect(panel.locator(`input[value="${name}"]`)).toBeVisible();
    }
  });

  test('adding a color token writes a new variable to theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.getByRole('button', { name: /^Theme/ }).click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: /^\+ Add Color/ }).click();

    // The new token seeds as `--color-N` with a grey fill (#888888).
    // Poll disk until the new row shows up — the write happens
    // immediately on add.
    await expect
      .poll(async () => readTheme(project.dir), { timeout: 5_000 })
      .toMatch(/--color-1:\s*#888888/);
  });

  test('renaming a token updates theme.css', async ({ window, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.getByRole('button', { name: /^Theme/ }).click();
    const panel = window.getByTestId('theme-panel');

    // Walk the rendered inputs to find the --color-muted row —
    // `input[value=...]` relies on React reflecting the DOM
    // attribute, which it doesn't for controlled inputs after the
    // initial render.
    const rows = panel.locator('input[type="text"]');
    const count = await rows.count();
    let mutedIdx = -1;
    for (let i = 0; i < count; i += 1) {
      const v = await rows.nth(i).inputValue();
      if (v === '--color-muted') {
        mutedIdx = i;
        break;
      }
    }
    expect(mutedIdx).toBeGreaterThanOrEqual(0);
    const target = rows.nth(mutedIdx);
    await target.fill('--brand-highlight');
    await target.press('Enter');

    await expect
      .poll(async () => readTheme(project.dir), { timeout: 5_000 })
      .toContain('--brand-highlight');
    expect(await readTheme(project.dir)).not.toContain('--color-muted');
  });

  test('deleting a token removes it from theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.getByRole('button', { name: /^Theme/ }).click();
    const panel = window.getByTestId('theme-panel');

    const mutedRow = panel.locator('input[value="--color-muted"]').first();
    await expect(mutedRow).toBeVisible();
    // The row's delete button is an "x" sibling of the name input.
    const row = panel
      .locator('input[value="--color-muted"]')
      .first()
      .locator('..');
    await row.getByRole('button', { name: /^x$/ }).click();

    await expect
      .poll(async () => readTheme(project.dir), { timeout: 5_000 })
      .not.toContain('--color-muted');
  });
});
