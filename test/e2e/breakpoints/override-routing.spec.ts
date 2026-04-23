import { test, expect } from '../fixtures/app';
import { switchBreakpoint } from '../fixtures/breakpoints';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

/**
 * Style edits made while a non-desktop breakpoint is active land
 * inside that breakpoint's `@media (max-width: Npx)` block. The base
 * class stays put.
 */
test.describe('breakpoints: override routing', () => {
  test('padding edits at Tablet land in @media (max-width: 768px); base is unchanged', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    const className = await drawAndSelectRect(
      window,
      { x: 100, y: 100 },
      { x: 260, y: 200 }
    );
    // Baseline padding at desktop.
    await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '24');
    await waitForSaved(window);

    await switchBreakpoint(window, 'tablet', 'Tablet');

    // Tablet override.
    await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '12');
    await waitForSaved(window);

    const { css } = await readPageFiles(project.dir, project.pageName);

    // Base class still carries 24px padding.
    const baseBlockMatch = css.match(
      new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`)
    );
    expect(baseBlockMatch).not.toBeNull();
    expect(baseBlockMatch![1]).toMatch(/padding:\s*24px 24px 24px 24px/);

    // A media block for Tablet (768) exists and carries the 12px override.
    const mediaBlockMatch = css.match(
      /@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/
    );
    expect(mediaBlockMatch).not.toBeNull();
    expect(mediaBlockMatch![1]).toContain(`.${className}`);
    expect(mediaBlockMatch![1]).toMatch(/padding:\s*12px 12px 12px 12px/);
  });
});
