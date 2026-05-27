import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The History tab in the left sidebar surfaces every canvas mutation
 * as a labelled entry. The same underlying stack drives Cmd+Z /
 * Cmd+Shift+Z, so we test the visual interface here and let the
 * basic-undo-redo spec cover the keyboard path.
 */
test.describe('history panel', () => {
    test('empty state reads "No changes made in this session"', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.getByRole('tab', { name: 'History' }).click();
        await expect(window.getByText('No changes made in this session')).toBeVisible();
    });
    test('drawing a rectangle adds a "Drew rectangle" entry', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 200 });
        await waitForSaved(window);
        await window.getByRole('tab', { name: 'History' }).click();
        await expect(window.getByText('Drew rectangle')).toBeVisible();
    });
    test('clicking an older entry restores the canvas to that point', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Two rectangles → two history entries.
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 180, y: 160 });
        await waitForSaved(window);
        await drawAndSelectRect(window, { x: 220, y: 80 }, { x: 320, y: 160 });
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
        // Open the History tab and click the first (older) Drew rectangle.
        // The list renders newest-first, so the second entry in DOM order
        // is the older one.
        await window.getByRole('tab', { name: 'History' }).click();
        const entries = window.getByText('Drew rectangle');
        await expect(entries).toHaveCount(2);
        await entries.nth(1).click();
        // Jumping back to the first entry removes the second rect.
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
    });
    test('Cmd+Shift+H toggles between Pages & Layers and History', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const layersTab = window.getByRole('tab', { name: 'Pages & Layers' });
        const historyTab = window.getByRole('tab', { name: 'History' });
        // Default is layers.
        await expect(layersTab).toHaveAttribute('aria-selected', 'true');
        await expect(historyTab).toHaveAttribute('aria-selected', 'false');
        // Shortcut flips to history.
        await window.keyboard.press('ControlOrMeta+Shift+h');
        await expect(historyTab).toHaveAttribute('aria-selected', 'true');
        await expect(layersTab).toHaveAttribute('aria-selected', 'false');
        // Shortcut again flips back.
        await window.keyboard.press('ControlOrMeta+Shift+h');
        await expect(layersTab).toHaveAttribute('aria-selected', 'true');
        await expect(historyTab).toHaveAttribute('aria-selected', 'false');
    });
    test('new edit after jumping back discards the forward entries', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 180, y: 160 });
        await waitForSaved(window);
        await drawAndSelectRect(window, { x: 220, y: 80 }, { x: 320, y: 160 });
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
        // Jump back to the first entry.
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByText('Drew rectangle').nth(1).click();
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
        // Switch back to Layers to draw, then a fresh draw discards the
        // forward stack (the previously-undone second rectangle).
        await window.getByRole('tab', { name: 'Pages & Layers' }).click();
        await drawAndSelectRect(window, { x: 80, y: 200 }, { x: 180, y: 280 });
        await waitForSaved(window);
        // Two rectangles total — first + new one. The original second
        // rect is gone from the forward stack and not redoable.
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
        await window.keyboard.press('ControlOrMeta+Shift+z');
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
    });
});
