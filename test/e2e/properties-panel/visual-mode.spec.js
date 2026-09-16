import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { drawAndSelectRect, panelSection, propertiesPanel } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
/**
 * The typed "Visual" panel renders different sections per element
 * type. This spec locks the section list for each type so a refactor
 * that drops a section can't silently ship.
 */
test.describe('properties panel: visual mode section layout', () => {
    test('offers the shortcuts as a collapsed reference when nothing is selected', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await expect(propertiesPanel(window)).toHaveAttribute('data-panel-mode', 'empty');
        // A reference, not the main event: the section shows, the table waits.
        const disclosure = window.getByRole('button', { name: 'Keyboard Shortcuts' });
        await expect(disclosure).toBeVisible();
        await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
        await expect(window.getByText('Select tool')).toHaveCount(0);
        await disclosure.click();
        await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
        await expect(window.getByText('Select tool')).toBeVisible();
    });
    test('keeps the element-level mode toggle out of the empty state', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Visual and CSS describe a selected element; with none, they'd show
        // nothing. see docs/notes/routes-in-the-app.md
        await expect(window.getByRole('radio', { name: 'Visual' })).toHaveCount(0);
        await expect(window.getByRole('radio', { name: 'CSS' })).toHaveCount(0);
    });
    test('rectangle shows Element, Position, Size, Layout, Spacing, Background, Border, Visibility', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 260, y: 200 });
        for (const title of [
            'Element',
            'Position',
            'Size',
            'Layout',
            'Spacing',
            'Background',
            'Border',
            'Visibility',
        ]) {
            await expect(panelSection(window, title)).toBeVisible();
        }
        await expect(panelSection(window, 'Typography')).toHaveCount(0);
        await expect(panelSection(window, 'Image')).toHaveCount(0);
    });
    test('text element shows Typography, hides Layout', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 't');
        await dragInFrame(window, { x: 150, y: 150 }, { x: 152, y: 152 });
        // Text creation opens contentEditable — commit by blurring.
        await window.keyboard.press('Escape');
        await expect(panelSection(window, 'Typography')).toBeVisible();
        // Layout section isn't rendered for text elements (they aren't
        // containers, so flex display doesn't apply).
        await expect(panelSection(window, 'Layout')).toHaveCount(0);
    });
    test('input element hides Layout + Typography, shows Background + Border', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'f');
        await dragInFrame(window, { x: 100, y: 200 }, { x: 340, y: 240 });
        await expect(canvasElementsByPrefix(window, 'input_').first()).toBeVisible();
        await expect(panelSection(window, 'Background')).toBeVisible();
        await expect(panelSection(window, 'Border')).toBeVisible();
        await expect(panelSection(window, 'Layout')).toHaveCount(0);
        await expect(panelSection(window, 'Typography')).toHaveCount(0);
    });
});
