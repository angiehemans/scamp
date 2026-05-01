import { test, expect } from '../fixtures/app';
import { canvasSizeButton, switchBreakpoint, } from '../fixtures/breakpoints';
import { canvasFrame, pageRoot } from '../fixtures/selectors';
test.describe('breakpoints: switch active breakpoint', () => {
    test('starts on Desktop; button reads "Desktop · 1440"', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        const button = canvasSizeButton(window);
        await expect(button).toHaveAttribute('data-active-breakpoint', 'desktop');
        await expect(button).toContainText('Desktop');
        await expect(button).toContainText('1440');
    });
    test('opens the popover and switches to Tablet', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await switchBreakpoint(window, 'tablet', 'Tablet');
        // Canvas frame resizes — logical width is now 768 (reflected in the
        // dataset attribute we set in Viewport).
        await expect(canvasFrame(window)).toHaveAttribute('data-canvas-width', '768');
        await expect(canvasSizeButton(window)).toContainText('Tablet');
        await expect(canvasSizeButton(window)).toContainText('768');
    });
    test('switching back to Desktop reverts canvas width', async ({ window }) => {
        await expect(pageRoot(window)).toBeVisible();
        await switchBreakpoint(window, 'mobile', 'Mobile');
        await expect(canvasFrame(window)).toHaveAttribute('data-canvas-width', '390');
        await switchBreakpoint(window, 'desktop', 'Desktop');
        await expect(canvasFrame(window)).toHaveAttribute('data-canvas-width', '1440');
    });
});
