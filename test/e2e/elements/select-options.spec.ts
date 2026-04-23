import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { commitInput, panelSection } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';

test.describe('elements: select + options editor', () => {
  test('adding options to a <select> emits <option> children in TSX', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    await selectTool(window, 'f');
    await dragInFrame(window, { x: 100, y: 120 }, { x: 300, y: 160 });
    await canvasElementsByPrefix(window, 'input_').first().waitFor();
    await waitForSaved(window);

    const section = panelSection(window, 'Element');
    await section.locator('select').first().selectOption('select');

    // Add two options and give them values + labels.
    await section.getByRole('button', { name: /\+ Add option/ }).click();
    const firstValueInput = section.locator('input[placeholder="value"]').first();
    const firstLabelInput = section.locator('input[placeholder="label"]').first();
    await commitInput(firstValueInput, 'one');
    await commitInput(firstLabelInput, 'Option 1');

    await section.getByRole('button', { name: /\+ Add option/ }).click();
    const secondValueInput = section.locator('input[placeholder="value"]').nth(1);
    const secondLabelInput = section.locator('input[placeholder="label"]').nth(1);
    await commitInput(secondValueInput, 'two');
    await commitInput(secondLabelInput, 'Option 2');

    await waitForSaved(window);
    const { tsx } = await readPageFiles(project.dir, project.pageName);
    expect(tsx).toMatch(/<select[^>]*>/);
    expect(tsx).toMatch(/<option[^>]*value="one"[^>]*>Option 1<\/option>/);
    expect(tsx).toMatch(/<option[^>]*value="two"[^>]*>Option 2<\/option>/);
  });
});
