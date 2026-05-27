import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, propertiesPanel, setPanelMode } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: CSS mode', () => {
  test('switching to CSS mode and editing declarations writes to disk', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    await setPanelMode(window, 'CSS');
    await expect(propertiesPanel(window)).toHaveAttribute('data-panel-mode', 'css');

    // CodeMirror: focus by clicking into the content area, then type a
    // custom declaration that doesn't collide with anything the visual
    // panel emits. CodeMirror closes brackets automatically — wrap the
    // whole declaration so we don't fight it.
    const editor = propertiesPanel(window).locator('.cm-content').first();
    await editor.click();
    await window.keyboard.type('letter-spacing: 4px;');
    // Commit via Cmd+S so the blur path also works identically.
    await window.keyboard.press('Control+s');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*letter-spacing:\\s*4px`, 's')
    );
  });

  test('Cmd+S commits two sequential CSS edits without losing the first', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await waitForSaved(window);

    await setPanelMode(window, 'CSS');
    const editor = propertiesPanel(window).locator('.cm-content').first();

    // First edit + Cmd+S.
    await editor.click();
    await window.keyboard.type('letter-spacing: 4px;');
    await window.keyboard.press('Control+s');
    await waitForSaved(window);

    // Second edit + Cmd+S — the regression to guard against is the
    // first edit's chokidar echo getting absorbed by the late-echo
    // guard and the panel not refreshing, so the second Cmd+S writes
    // stale text and the first edit gets clobbered. We assert BOTH
    // declarations make it to disk.
    await editor.click();
    await window.keyboard.press('End');
    await window.keyboard.press('Enter');
    await window.keyboard.type('word-spacing: 2px;');
    await window.keyboard.press('Control+s');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*letter-spacing:\\s*4px`, 's')
    );
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*word-spacing:\\s*2px`, 's')
    );
  });
});
