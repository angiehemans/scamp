import { test, expect } from '../fixtures/app';
import {
  canvasSizeButton,
  canvasSizePopover,
  closeProjectSettings,
  openProjectSettings,
  switchBreakpoint,
} from '../fixtures/breakpoints';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('breakpoints: custom breakpoint', () => {
  test('adding a custom breakpoint surfaces it in the canvas-size popover', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await openProjectSettings(window);

    // Add a breakpoint — the editor seeds it at 600px with label "Custom".
    await window.getByRole('button', { name: '+ Add breakpoint' }).click();
    await closeProjectSettings(window);

    // The new breakpoint appears in the canvas-size popover.
    await canvasSizeButton(window).click();
    await expect(
      canvasSizePopover(window).getByRole('button', { name: /Custom/ })
    ).toBeVisible();
  });

  test('edits at a custom breakpoint emit its @media (max-width) block', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '20');
    await waitForSaved(window);

    // Add a custom breakpoint.
    await openProjectSettings(window);
    await window.getByRole('button', { name: '+ Add breakpoint' }).click();
    await closeProjectSettings(window);

    // Switch to the new one and edit padding.
    await switchBreakpoint(window, 'custom-1', 'Custom');
    await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '4');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(/@media \(max-width: 600px\)/);
    const mediaMatch = css.match(
      /@media \(max-width: 600px\)\s*\{([\s\S]*?)\n\}/
    );
    expect(mediaMatch).not.toBeNull();
    expect(mediaMatch![1]).toContain(`.${className}`);
    expect(mediaMatch![1]).toMatch(/padding:\s*4px 4px 4px 4px/);
  });
});
