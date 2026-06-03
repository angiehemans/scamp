import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, propertiesPanel, setPanelMode } from '../fixtures/panel';
import { createComponentFromSidebar } from '../fixtures/components';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

test.use({ projectOptions: { format: 'nextjs' } });

test.describe('components: CSS panel inside the component editor', () => {
  test('Cmd+S saves CSS edits to the component module file', async ({
    window,
    project,
  }) => {
    // Regression guard: CssPanel only set editTargetRef when
    // activePage was set, so in the component editor (where
    // activeComponent is set and activePage is null) the save
    // target was null and Cmd+S + click-outside both silently
    // no-op'd. Fix routes editTargetRef through whichever of
    // activePage / activeComponent is currently active.
    await expect(pageRoot(window)).toBeVisible();

    await createComponentFromSidebar(window, 'Card');

    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 220, y: 180 }
    );
    await waitForSaved(window);

    await setPanelMode(window, 'CSS');
    const editor = propertiesPanel(window).locator('.cm-content').first();
    await editor.click();
    // Land cursor at end-of-content + new line so the appended
    // declaration doesn't splice into an existing line and break
    // the CSS parser. (Autocomplete + mid-line insertion was the
    // source of the original flake.)
    //
    // ControlOrMeta — CodeMirror's `Mod-End` binding maps to
    // Cmd+End on macOS and Ctrl+End on Linux. Sending a literal
    // `Control+End` on macOS is a no-op, and the typed text
    // splices into wherever `editor.click()` left the cursor
    // (mid-line, between `:` and `;` of an existing declaration).
    await window.keyboard.press('ControlOrMeta+End');
    await window.keyboard.press('Enter');
    await window.keyboard.type('letter-spacing: 4px;');
    await window.keyboard.press('ControlOrMeta+s');
    await waitForSaved(window);

    const { css } = await project.readComponent('Card');
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*letter-spacing:\\s*4px`, 's')
    );
  });

  test('blur (click outside the editor) also commits CSS edits', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await createComponentFromSidebar(window, 'Card');

    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 220, y: 180 }
    );
    await waitForSaved(window);

    await setPanelMode(window, 'CSS');
    const editor = propertiesPanel(window).locator('.cm-content').first();
    await editor.click();
    // ControlOrMeta+End — see Cmd+S test above for the macOS-vs-Linux
    // CodeMirror keymap rationale.
    await window.keyboard.press('ControlOrMeta+End');
    await window.keyboard.press('Enter');
    await window.keyboard.type('word-spacing: 2px;');

    // Blur path: click the sidebar (canvas chrome would intercept
    // clicks on the page root, even on the empty whitespace).
    await window
      .getByRole('button', { name: /Add Component/i })
      .click({ trial: false, force: false });
    await waitForSaved(window);

    const { css } = await project.readComponent('Card');
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*word-spacing:\\s*2px`, 's')
    );
  });
});
