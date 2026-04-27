import { test, expect } from '../fixtures/app';
import {
  commitInput,
  drawAndSelectRect,
  panelInputByPrefix,
  panelSection,
} from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('properties panel: layout / flex', () => {
  test('toggling to Flex emits display:flex and flex controls write CSS', async ({
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

    const layout = panelSection(window, 'Layout');
    // The display toggle is icon-only — query by the per-option
    // aria-label SegmentedControl now sets.
    await layout.getByRole('radio', { name: 'Flex row' }).click();
    await waitForSaved(window);
    let css = (await readPageFiles(project.dir, project.pageName)).css;
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*display:\\s*flex`, 's'));

    // Direction is now part of the same toggle — switching to "Flex
    // column" emits `flex-direction: column`.
    await layout.getByRole('radio', { name: 'Flex column' }).click();
    await waitForSaved(window);
    css = (await readPageFiles(project.dir, project.pageName)).css;
    expect(css).toMatch(
      new RegExp(`\\.${className}[^}]*flex-direction:\\s*column`, 's')
    );

    // Gap.
    const gapInput = panelInputByPrefix(window, 'Layout', 'Gap');
    await commitInput(gapInput, '16');
    await waitForSaved(window);
    css = (await readPageFiles(project.dir, project.pageName)).css;
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*gap:\\s*16px`, 's'));
  });
});
