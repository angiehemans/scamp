import { test, expect } from '../fixtures/app';
import { frameOverflow, setClipContent, switchBreakpoint, } from '../fixtures/breakpoints';
import { pageRoot } from '../fixtures/selectors';
/**
 * "Clip content" is a canvas-view toggle: on → the frame gets
 * `overflow: hidden`; off → content spills. It is stored per breakpoint,
 * so toggling it at one width must not affect another. None of this
 * touches the page CSS — it's purely a viewport-preview helper.
 */
test.describe('canvas clip content', () => {
    test('toggles the frame between clipped and visible overflow', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Default: content is not clipped.
        expect(await frameOverflow(window)).toBe('visible');
        await setClipContent(window, true);
        expect(await frameOverflow(window)).toBe('hidden');
        await setClipContent(window, false);
        expect(await frameOverflow(window)).toBe('visible');
    });
    test('remembers clip state per breakpoint', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Turn clip ON at desktop only.
        await setClipContent(window, true);
        expect(await frameOverflow(window)).toBe('hidden');
        // Mobile has its own (default off) state.
        await switchBreakpoint(window, 'mobile', 'Mobile');
        expect(await frameOverflow(window)).toBe('visible');
        // Back to desktop — the clip is still on.
        await switchBreakpoint(window, 'desktop', 'Desktop');
        expect(await frameOverflow(window)).toBe('hidden');
    });
});
