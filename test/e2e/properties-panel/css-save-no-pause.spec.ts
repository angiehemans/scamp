import { test, expect } from '../fixtures/app';
import { dragInFrame } from '../fixtures/canvas';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
  propertiesPanel,
  setPanelMode,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * A Cmd+S from the CSS panel is Scamp's own write. Its chokidar echo
 * used to be classified as an external edit, so the indicator showed
 * "Paused — an external editor is writing…" for 2.5 s after every save
 * before flipping to Saved. These specs record every indicator state
 * after the save and assert Paused never appears — including when the
 * user keeps working during the window that used to be paused.
 * see docs/notes/save-status-machine.md
 */

type W = Parameters<typeof pageRoot>[0];

const typeAndSave = async (window: W, declaration: string): Promise<void> => {
  const editor = propertiesPanel(window).locator('.cm-content').first();
  await editor.click();
  await window.keyboard.press('ControlOrMeta+End');
  await window.keyboard.press('Enter');
  await window.keyboard.type(declaration);
  await window.keyboard.press('ControlOrMeta+s');
};

/** Every distinct `data-status` the indicator shows over `ms`. */
const statusesFor = async (window: W, ms: number): Promise<string[]> => {
  const status = window.locator('[data-testid="save-status"]');
  const seen: string[] = [];
  const start = Date.now();
  while (Date.now() - start < ms) {
    const s = (await status.getAttribute('data-status')) ?? 'none';
    if (seen[seen.length - 1] !== s) seen.push(s);
    await window.waitForTimeout(40);
  }
  return seen;
};

const setup = async (window: W): Promise<string> => {
  await expect(pageRoot(window)).toBeVisible();
  const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
  await waitForSaved(window);
  await setPanelMode(window, 'CSS');
  return className;
};

test.describe('properties panel: a CSS-panel save is not an external edit', () => {
  test('Cmd+S goes Saving → Saved with no Paused in between', async ({ window, project }) => {
    const className = await setup(window);
    await typeAndSave(window, 'cursor: pointer;');
    const seen = await statusesFor(window, 3500);
    expect(seen).not.toContain('paused');
    expect(seen[seen.length - 1]).toBe('saved');
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*cursor:\\s*pointer`, 's'));
  });

  test('a canvas drag right after the save keeps both the edit and the drag', async ({
    window,
    project,
  }) => {
    const className = await setup(window);
    await typeAndSave(window, 'cursor: pointer;');
    await window.waitForTimeout(300);
    await dragInFrame(window, { x: 180, y: 150 }, { x: 260, y: 200 });
    const seen = await statusesFor(window, 3500);
    expect(seen).not.toContain('paused');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*cursor:\\s*pointer`, 's'));
  });

  test('a Visual-panel edit right after the save keeps both', async ({ window, project }) => {
    const className = await setup(window);
    await typeAndSave(window, 'cursor: pointer;');
    await window.waitForTimeout(300);
    await setPanelMode(window, 'Visual');
    await commitInput(panelInputByPrefix(window, 'Size', 'W'), '220');
    const seen = await statusesFor(window, 3500);
    expect(seen).not.toContain('paused');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*cursor:\\s*pointer`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*220px`, 's'));
  });

  test('a second Cmd+S straight after the first keeps both declarations', async ({
    window,
    project,
  }) => {
    const className = await setup(window);
    await typeAndSave(window, 'cursor: pointer;');
    await window.waitForTimeout(300);
    await typeAndSave(window, 'outline-offset: 2px;');
    const seen = await statusesFor(window, 3500);
    expect(seen).not.toContain('paused');
    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*cursor:\\s*pointer`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*outline-offset:\\s*2px`, 's'));
  });
});
