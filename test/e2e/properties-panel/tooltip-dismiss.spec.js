import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelInputByPrefix } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * Properties-panel tooltips used to stick open on the Size fields, which
 * are edited constantly.
 *
 * The trigger is the row `<div>`, and React's `onFocus` bubbles up from
 * the inner `<input>` — so clicking a field opened a tooltip. With the
 * pointer resting on the field no `mouseleave` ever followed, and the
 * canvas's mousedown handlers preventDefault so the input need never
 * blur. The tooltip survived until something else stole focus.
 *
 * Hover still opens one; only the click-raised path is suppressed.
 */
const tooltips = (page) => page.getByRole('tooltip');
/** Longer than the 400 ms show delay, so a late timer would surface. */
const PAST_DELAY = 700;
test.describe('properties panel: tooltip dismissal', () => {
    test('clicking a size field with the pointer parked opens no tooltip', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 240, y: 200 });
        await waitForSaved(window);
        const width = panelInputByPrefix(window, 'Size', 'W');
        await width.click();
        await window.waitForTimeout(PAST_DELAY);
        expect(await tooltips(window).count()).toBe(0);
    });
    test('a hovered tooltip closes when the field is clicked', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 240, y: 200 });
        await waitForSaved(window);
        const width = panelInputByPrefix(window, 'Size', 'W');
        await width.hover();
        await expect(tooltips(window).first()).toBeVisible({ timeout: 2_000 });
        // The click dismisses it rather than leaving it up for the rest of
        // the edit, and it must not come back while the field holds focus.
        await width.click();
        await window.waitForTimeout(PAST_DELAY);
        expect(await tooltips(window).count()).toBe(0);
    });
    test('committing a value leaves no tooltip behind', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 240, y: 200 });
        await waitForSaved(window);
        const width = panelInputByPrefix(window, 'Size', 'W');
        await width.click({ clickCount: 3 });
        await width.fill('180');
        await width.press('Enter');
        await window.waitForTimeout(PAST_DELAY);
        expect(await tooltips(window).count()).toBe(0);
    });
    test('hovering still opens a tooltip, and Escape dismisses it', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 240, y: 200 });
        await waitForSaved(window);
        // The fix must not cost the hover tooltip.
        await panelInputByPrefix(window, 'Size', 'W').hover();
        await expect(tooltips(window).first()).toBeVisible({ timeout: 2_000 });
        await window.keyboard.press('Escape');
        await expect(tooltips(window)).toHaveCount(0);
    });
});
