import { test, expect } from '../fixtures/app';
import {
  canvasSizeButton,
  canvasSizePopover,
  switchBreakpoint,
} from '../fixtures/breakpoints';
import { pageRoot } from '../fixtures/selectors';

/**
 * The canvas-size popover holds breakpoint preset buttons AND a
 * "Custom width" input. Typing a custom width drops the active
 * breakpoint back to Desktop because no preset matches.
 */
test.describe('canvas: custom width input', () => {
  test('typing a custom canvas width drops the breakpoint back to Desktop', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // Start at a non-desktop breakpoint so the desktop-revert is observable.
    await switchBreakpoint(window, 'tablet', 'Tablet');
    await expect(canvasSizeButton(window)).toHaveAttribute(
      'data-active-breakpoint',
      'tablet'
    );

    // Open the popover and type a custom width that doesn't match any
    // breakpoint preset.
    await canvasSizeButton(window).click();
    const popover = canvasSizePopover(window);
    const customWidthInput = popover.locator('input[type="text"]').last();
    await customWidthInput.click({ clickCount: 3 });
    await customWidthInput.fill('1234');
    await customWidthInput.press('Enter');

    // The active breakpoint should drop to desktop.
    await expect(canvasSizeButton(window)).toHaveAttribute(
      'data-active-breakpoint',
      'desktop'
    );
  });
});
