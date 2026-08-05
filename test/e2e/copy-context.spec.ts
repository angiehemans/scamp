import type { ElectronApplication } from '@playwright/test';

import { test, expect } from './fixtures/app';
import { dragInFrame, selectTool } from './fixtures/canvas';
import { pageRoot } from './fixtures/selectors';

/**
 * Copy context, end to end. The unit tests cover what the string says; this
 * is the only level that proves the button and the shortcut reach the real
 * OS clipboard — and that the panel inputs keep normal copy behaviour.
 * see docs/plans/copy-context-button-plan.md
 */

test.use({ projectOptions: { format: 'nextjs' } });

const copyButton = (window: Parameters<typeof selectTool>[0]) =>
  window.locator('[data-action="copy-context"]');

/**
 * The real clipboard, read from the MAIN process. The renderer's own
 * `readClipboard` only understands svg / image / empty, so it can't see
 * plain text — Electron's `clipboard` module in main can.
 */
const clipboardText = (app: ElectronApplication): Promise<string> =>
  app.evaluate(({ clipboard }) => clipboard.readText());

const seedClipboard = (app: ElectronApplication, text: string): Promise<void> =>
  app.evaluate(({ clipboard }, value) => clipboard.writeText(value), text);

test.describe('copy context', () => {
  test('the toolbar offers the button, enabled with nothing selected', async ({
    window,
  }) => {
    // The page-level string is useful on its own; dimming it would hide the
    // feature exactly when someone asks a whole-page question.
    await expect(pageRoot(window)).toBeVisible();
    await expect(copyButton(window)).toBeVisible();
    await expect(copyButton(window)).toBeEnabled();
  });

  test('clicking copies the page context when nothing is selected', async ({
    window,
    app,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await seedClipboard(app, 'SENTINEL');
    await copyButton(window).click();
    await expect
      .poll(async () => clipboardText(app), { timeout: 3000 })
      .toContain('elements on canvas');
    expect(await clipboardText(app)).toContain('Context: app/page.tsx');
  });

  test('clicking names the selected element and its styles', async ({
    window,
    app,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 240, y: 180 });
    await seedClipboard(app, 'SENTINEL');
    await copyButton(window).click();
    await expect
      .poll(async () => clipboardText(app), { timeout: 3000 })
      .toMatch(/Context: app\/page\.tsx → \.rect_[0-9a-f]{4} \(div/);
    expect(await clipboardText(app)).toContain(
      'Full styles in app/page.module.css.'
    );
  });

  test('the copied string is a single line', async ({ window, app }) => {
    // It gets pasted in front of a prompt; a newline would break the paste.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 200, y: 160 });
    await copyButton(window).click();
    await expect
      .poll(async () => clipboardText(app), { timeout: 3000 })
      .toContain('Context:');
    expect(await clipboardText(app)).not.toContain('\n');
  });

  test('confirms with a check mark, then reverts', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await copyButton(window).click();
    await expect(copyButton(window)).toHaveAttribute('data-copied', 'true');
    await expect(copyButton(window)).not.toHaveAttribute('data-copied', 'true', {
      timeout: 4000,
    });
  });

  test('the shortcut copies too', async ({ window, app }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 200, y: 160 });
    await seedClipboard(app, 'SENTINEL');
    await window.keyboard.press('ControlOrMeta+Shift+KeyC');
    await expect
      .poll(async () => clipboardText(app), { timeout: 3000 })
      .toMatch(/\.rect_[0-9a-f]{4}/);
  });

  test('the shortcut leaves the clipboard alone when a field has focus', async ({
    window,
    app,
  }) => {
    // `isEditableTarget` covers every panel input and CodeMirror, whose
    // editor is contentEditable — so the CSS panel keeps normal copy.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 60, y: 60 }, { x: 200, y: 160 });

    await seedClipboard(app, 'SENTINEL-UNTOUCHED');
    await window
      .locator('[data-testid="properties-panel"] input[type="text"]')
      .first()
      .click();
    await window.keyboard.press('ControlOrMeta+Shift+KeyC');

    // Give the handler a chance to (incorrectly) fire.
    await window.waitForTimeout(600);
    expect(await clipboardText(app)).toBe('SENTINEL-UNTOUCHED');
  });
});
