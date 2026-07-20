import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';

test.use({ projectOptions: { format: 'nextjs' } });

test.describe('themes: panel CRUD', () => {
  test('opening the panel lists the seeded tokens', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    // The Design System rail icon opens the theme panel.
    await window.locator('[data-section="design-system"]').click();

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

  test('adding a semantic color writes a new variable to theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: /^\+ Add semantic color/ }).click();

    // A new semantic token maps to the first seeded palette's 500 shade
    // under the reserved `--color-custom` name (no numeric suffix, so it
    // can't be misread as a primitive shade). Poll disk — the write
    // happens immediately on add.
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toMatch(/--color-custom:\s*var\(--color-brand-500\)/);
  });

  test('adding a palette writes a full 50–900 ramp to theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: /^\+ Add palette/ }).click();

    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toMatch(/--color-palette-500:\s*#[0-9a-f]{6}/i);
    const css = await project.readTheme();
    for (const shade of [50, 100, 500, 900]) {
      expect(css).toMatch(new RegExp(`--color-palette-${shade}:\\s*#[0-9a-f]{6}`, 'i'));
    }
  });

  test('mapping a semantic token to a primitive writes a var() reference', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    // A palette must exist for the mapping dropdown to have options.
    await panel.getByRole('button', { name: /^\+ Add palette/ }).click();
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--color-palette-500');

    const select = panel.locator(
      'select[aria-label="Mapping for --color-primary"]'
    );
    await select.selectOption('palette:500');

    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--color-primary: var(--color-palette-500)');
  });

  test('renaming a token updates theme.css', async ({ window, project }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
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
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--brand-highlight');
    expect(await project.readTheme()).not.toContain('--color-muted');
  });

  test('deleting a token removes it from theme.css', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
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
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .not.toContain('--color-muted');
  });

  test('the section nav scroll-jumps the editor to a section', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    await expect(window.getByTestId('theme-panel')).toBeVisible();

    // The left sidebar shows the theme section nav; both sections render
    // stacked in the main editor.
    const nav = window.getByTestId('theme-section-nav');
    await expect(nav).toBeVisible();
    const typography = window.locator('[data-theme-section="typography"]');
    await expect(window.locator('[data-theme-section="colors"]')).toBeVisible();
    await expect(typography).toBeVisible();

    // Clicking Typography in the nav scrolls its section into view.
    await nav.locator('[data-theme-nav="typography"]').click();
    await expect(typography).toBeInViewport();
  });

  test('the token list scrolls instead of spilling out when there are many tokens', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    const addColor = panel.getByRole('button', { name: /^\+ Add semantic color/ });
    for (let i = 0; i < 20; i += 1) {
      await addColor.click();
    }

    // Read viewport height from the DOM — the outer `window` is
    // Playwright's Page (renamed in the fixture), so reading
    // `window.innerHeight` would refer to it instead of the browser.
    const viewportHeight = await window.evaluate(
      () => document.documentElement.clientHeight
    );
    const dialogBox = await panel.boundingBox();
    if (!dialogBox) throw new Error('dialog has no bounding box');
    expect(dialogBox.height).toBeLessThanOrEqual(viewportHeight);
    expect(dialogBox.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(viewportHeight);
  });

  test('adding a token scrolls the list to the new row', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    // Add enough tokens to overflow the visible list.
    const addColor = panel.getByRole('button', { name: /^\+ Add semantic color/ });
    for (let i = 0; i < 15; i += 1) {
      await addColor.click();
    }

    // The most-recently added token is the last row of the colors
    // section. After the click, that row must be visible — not hidden
    // below the scroll viewport.
    const lastRow = panel
      .locator('[data-theme-section="colors"] [data-token-row]')
      .last();
    await expect(lastRow).toBeInViewport();
  });
});

test.describe('themes: panel is read-only in legacy projects', () => {
  test.use({ projectOptions: { format: 'legacy' } });

  test('shows a migration notice instead of the token editor', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();

    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();
    // Legacy format → read-only notice, no editable token controls.
    await expect(panel.getByText(/Next\.js project format/i)).toBeVisible();
    await expect(
      panel.getByRole('button', { name: /\+ Add palette/ })
    ).toHaveCount(0);
  });
});
