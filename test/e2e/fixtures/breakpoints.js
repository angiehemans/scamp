import { expect } from '@playwright/test';
/** Canvas-size button in the canvas header. */
export const canvasSizeButton = (page) => page.locator('[data-testid="canvas-size-button"]');
/** The canvas-size popover (role=dialog). */
export const canvasSizePopover = (page) => page.locator('[data-testid="canvas-size-popover"]');
/**
 * Open the canvas-size popover and click the named breakpoint preset.
 * The popover doesn't auto-close on selection (so the user can
 * compare widths) — we send Escape so specs leave the popover closed
 * and the next interaction doesn't get intercepted.
 */
export const switchBreakpoint = async (page, bpId, visibleLabel) => {
    await canvasSizeButton(page).click();
    await canvasSizePopover(page)
        .getByRole('button', { name: new RegExp(`^${visibleLabel}\\b`) })
        .first()
        .click();
    await expect(canvasSizeButton(page)).toHaveAttribute('data-active-breakpoint', bpId);
    await page.keyboard.press('Escape');
    await expect(canvasSizePopover(page)).toHaveCount(0);
};
/**
 * Open the project-settings full-page overlay via the element toolbar.
 * The floating toolbar's "Settings" button is the trigger — there's no
 * other visible "Settings" button inside an open project.
 */
export const openProjectSettings = async (page) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Project Settings' })).toBeVisible();
};
/** Close the project-settings page via its Back button. */
export const closeProjectSettings = async (page) => {
    await page.getByRole('button', { name: '← Back' }).click();
    await expect(page.getByRole('heading', { name: 'Project Settings' })).toHaveCount(0);
};
