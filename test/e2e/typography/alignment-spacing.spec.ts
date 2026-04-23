import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { commitInput, panelInputByPrefix, panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('typography: alignment + spacing', () => {
  test('align center, line-height, and letter-spacing all round-trip to CSS', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 't');
    await clickInFrame(window, { x: 180, y: 180 });
    await window.keyboard.press('Escape');
    const text = canvasElementsByPrefix(window, 'text_').first();
    await text.waitFor();
    const className = await text.getAttribute('data-scamp-id');
    if (!className) throw new Error('no text element');
    await waitForSaved(window);

    const typography = panelSection(window, 'Typography');

    // Text-align: the three align buttons live in a segmented control
    // with tooltip title "Text align". Click the 2nd radio (center).
    const alignGroup = typography.getByRole('radiogroup').last();
    await alignGroup.getByRole('radio').nth(1).click();

    // Line-height: prefix "LH".
    await commitInput(panelInputByPrefix(window, 'Typography', 'LH'), '1.6');
    // Letter-spacing: prefix "LS".
    await commitInput(panelInputByPrefix(window, 'Typography', 'LS'), '2');

    await waitForSaved(window);
    const { css } = await readPageFiles(project.dir, project.pageName);
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*text-align:\\s*center`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*line-height:\\s*1\\.6`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*letter-spacing:\\s*2px`, 's'));
  });
});
