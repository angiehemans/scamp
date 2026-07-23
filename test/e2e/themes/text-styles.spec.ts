import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.use({ projectOptions: { format: 'nextjs' } });

test.describe('themes: text styles', () => {
  test('adding default text styles writes the --text-<style>-<prop> token groups', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await window.locator('[data-section="design-system"]').click();
    const panel = window.getByTestId('theme-panel');
    await expect(panel).toBeVisible();

    await panel.getByTestId('add-default-text-styles').click();

    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--text-h1-size: 2.5rem');
    const css = await project.readTheme();
    expect(css).toContain('--text-h1-family: var(--font-sans)');
    expect(css).toContain('--text-h1-weight: 700');
    expect(css).toContain('--text-h1-leading: 1.2');
    // The Code style uses the mono family.
    expect(css).toContain('--text-code-family: var(--font-mono)');
  });

  test('applying a text style links the element to the style tokens', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // Seed the default text styles via the panel.
    await window.locator('[data-section="design-system"]').click();
    await window
      .getByTestId('theme-panel')
      .getByTestId('add-default-text-styles')
      .click();
    await expect
      .poll(async () => project.readTheme(), { timeout: 5_000 })
      .toContain('--text-h1-size');
    // Back to the page canvas.
    await window.locator('[data-section="pages"]').click();

    // Create + select a text element.
    await selectTool(window, 't');
    await clickInFrame(window, { x: 180, y: 180 });
    await window.keyboard.press('Escape');
    const text = canvasElementsByPrefix(window, 'text_').first();
    await text.waitFor();
    const className = await text.getAttribute('data-scamp-id');
    if (!className) throw new Error('no text element created');
    await waitForSaved(window);

    // Apply the H1 text style from the Typography header's preset menu.
    // Scope to the popover listbox — a native tag <select> also has an
    // `h1` option (name match is case-insensitive).
    await panelSection(window, 'Typography')
      .getByTestId('text-style-select')
      .click();
    await window
      .getByRole('listbox')
      .getByRole('option', { name: 'H1' })
      .click();
    await waitForSaved(window);

    const { css } = await project.readPage('home');
    // String props link to the style's tokens; weight is the concrete number.
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*font-size:\\s*var\\(--text-h1-size\\)`, 's')
    );
    expect(css).toMatch(
      new RegExp(
        `\\.${className}[^}]*line-height:\\s*var\\(--text-h1-leading\\)`,
        's'
      )
    );
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*font-weight:\\s*700`, 's')
    );
  });
});
