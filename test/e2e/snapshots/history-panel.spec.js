import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The History tab now lists PERSISTENT project snapshots (stored under
 * `.scamp/`), not the in-memory undo stack — Cmd+Z / Cmd+Shift+Z is
 * covered by the undo-redo specs. The panel has a "Now" marker, a
 * "Save snapshot" action, and clicking a snapshot restores it after a
 * confirmation. See docs/notes/snapshots.md.
 */
test.describe('history panel — snapshots', () => {
    test('shows the Now marker and a Save snapshot action', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.getByRole('tab', { name: 'History' }).click();
        await expect(window.getByText('Now', { exact: true })).toBeVisible();
        await expect(window.getByRole('button', { name: 'Save snapshot' })).toBeVisible();
    });
    test('saving a manual snapshot adds a named entry', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByRole('button', { name: 'Save snapshot' }).click();
        const input = window.getByPlaceholder('Snapshot name (optional)');
        await input.fill('before refactor');
        await input.press('Enter');
        await expect(window.getByText('before refactor')).toBeVisible();
    });
    test('restoring a snapshot rolls the canvas back', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        // One rectangle on disk, then snapshot it.
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 180, y: 160 });
        await waitForSaved(window);
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByRole('button', { name: 'Save snapshot' }).click();
        const input = window.getByPlaceholder('Snapshot name (optional)');
        await input.fill('one rect');
        await input.press('Enter');
        await expect(window.getByText('one rect')).toBeVisible();
        // Add a second rectangle (two on canvas now).
        await window.getByRole('tab', { name: 'Pages & Layers' }).click();
        await drawAndSelectRect(window, { x: 220, y: 80 }, { x: 320, y: 160 });
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
        // Restore the one-rect snapshot → confirm.
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByText('one rect').click();
        await window.getByRole('button', { name: 'Restore' }).click();
        // The project re-reads from disk and the canvas rolls back to one rect.
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
});
