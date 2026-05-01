import { test, expect } from '../fixtures/app';
import { selectTool } from '../fixtures/canvas';
import { drawAndSelectRect, panelInputByPrefix } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test.describe('keyboard shortcuts: tool shortcuts', () => {
    const TOOLS = [
        { key: 'v', tool: 'select' },
        { key: 'r', tool: 'rectangle' },
        { key: 't', tool: 'text' },
        // Skip 'i' here: activating image tool opens a native file dialog
        // that would block the rest of the test. Covered in elements/svg-source.
        { key: 'f', tool: 'input' },
    ];
    for (const { key, tool } of TOOLS) {
        test(`${key.toUpperCase()} activates the ${tool} tool`, async ({ window }) => {
            await expect(pageRoot(window)).toBeVisible();
            await selectTool(window, key);
            await expect(window.getByTestId('element-toolbar')).toHaveAttribute('data-active-tool', tool);
        });
    }
    test('tool shortcuts do not fire while a text input is focused', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 180 });
        await waitForSaved(window);
        // Focus a property-panel input (the width "W" field).
        await panelInputByPrefix(window, 'Size', 'W').click();
        await window.keyboard.press('r');
        // The keystroke went to the input, not the tool-shortcut handler.
        // Active tool stays as select (set automatically after draw).
        await expect(window.getByTestId('element-toolbar')).toHaveAttribute('data-active-tool', 'select');
    });
});
