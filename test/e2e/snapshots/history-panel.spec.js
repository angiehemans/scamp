import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The History tab shows a unified timeline: PERSISTENT project snapshots
 * (stored under `.scamp/`) interleaved with the active page's in-memory
 * undo entries for per-edit granularity. The panel has a "Now" marker and
 * a "Save snapshot" action; clicking a snapshot opens a read-only PREVIEW
 * on the canvas (banner with Restore / Exit), while clicking an undo entry
 * jumps the canvas to that point in-session. The Cmd+Z / Cmd+Shift+Z
 * keyboard path is covered by the undo-redo specs. See
 * docs/notes/snapshots.md.
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
    /** Draw one rect, snapshot it as "one rect", then draw a second. */
    const oneRectSnapshotThenTwo = async (window) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 180, y: 160 });
        await waitForSaved(window);
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByRole('button', { name: 'Save snapshot' }).click();
        const input = window.getByPlaceholder('Snapshot name (optional)');
        await input.fill('one rect');
        await input.press('Enter');
        await expect(window.getByText('one rect')).toBeVisible();
        await window.getByRole('tab', { name: 'Pages & Layers' }).click();
        await drawAndSelectRect(window, { x: 220, y: 80 }, { x: 320, y: 160 });
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
    };
    test('clicking a snapshot previews it read-only on the canvas', async ({ window, }) => {
        await oneRectSnapshotThenTwo(window);
        // Click the snapshot → enter preview. The banner appears and the
        // canvas shows the snapshot's single rectangle, WITHOUT restoring.
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByText('one rect').click();
        const banner = window.getByTestId('snapshot-preview-banner');
        await expect(banner).toBeVisible();
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
        // Exit discards the preview and returns to the live two-rect state.
        await banner.getByRole('button', { name: 'Exit' }).click();
        await expect(banner).toBeHidden();
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
    });
    test('restoring from the preview banner commits the snapshot', async ({ window, }) => {
        await oneRectSnapshotThenTwo(window);
        // Preview, then Restore from the banner → the rollback persists.
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByText('one rect').click();
        const banner = window.getByTestId('snapshot-preview-banner');
        await expect(banner).toBeVisible();
        await banner.getByRole('button', { name: 'Restore' }).click();
        // The project re-reads from disk; the canvas stays at one rect and the
        // banner clears.
        await expect(banner).toBeHidden();
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
    });
    test('clicking "Now" exits the preview', async ({ window }) => {
        await oneRectSnapshotThenTwo(window);
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByText('one rect').click();
        const banner = window.getByTestId('snapshot-preview-banner');
        await expect(banner).toBeVisible();
        // "Now" is the way back to the live state while previewing. Exact
        // match — the relative timestamps ("just now") also contain "Now".
        await window.getByRole('button', { name: 'Now', exact: true }).click();
        await expect(banner).toBeHidden();
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
    });
    test('navigating to another page releases a stuck snapshot-preview lock', async ({ window, }) => {
        // Regression: the read-only preview lock keys only on `snapshotPreview`
        // being set. Entering preview and then navigating away (without
        // clicking Exit) used to leak the lock onto the new page — the banner
        // vanished from the user's attention but draw/move/delete silently
        // no-op'd. loadPage now clears the lock. See docs/notes/snapshots.md.
        await oneRectSnapshotThenTwo(window);
        // Enter preview on the snapshot — canvas goes read-only.
        await window.getByRole('tab', { name: 'History' }).click();
        await window.getByText('one rect').click();
        const banner = window.getByTestId('snapshot-preview-banner');
        await expect(banner).toBeVisible();
        // Switch to a freshly-created page WITHOUT exiting the preview first.
        await window.getByRole('tab', { name: 'Pages & Layers' }).click();
        await window.getByRole('button', { name: /\+ Add Page/ }).click();
        const nameInput = window.getByPlaceholder('page-name');
        await nameInput.fill('about');
        await nameInput.press('Enter');
        // The lock must not leak onto About: the banner is gone and the canvas
        // is editable again. Draw + Delete both exercise snapshotPreview guards
        // (useDrawInteraction / the keyboard handler), so their success proves
        // the lock was released.
        await expect(banner).toBeHidden();
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 200, y: 180 });
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(1);
        await window.keyboard.press('Delete');
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(0);
    });
    test('interleaves in-session undo steps; clicking one jumps the canvas', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Two rectangles → two "Drew rectangle" undo entries on this page.
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 180, y: 160 });
        await waitForSaved(window);
        await drawAndSelectRect(window, { x: 220, y: 80 }, { x: 320, y: 160 });
        await waitForSaved(window);
        await expect(canvasElementsByPrefix(window, 'rect_')).toHaveCount(2);
        // The undo entries surface in the timeline alongside the snapshots.
        await window.getByRole('tab', { name: 'History' }).click();
        const entries = window.getByText('Drew rectangle');
        await expect(entries).toHaveCount(2);
        // The list renders newest-first, so the second entry in DOM order is
        // the older one. Clicking it jumps the canvas back to one rect — an
        // in-session jump, no disk restore.
        await entries.nth(1).click();
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
