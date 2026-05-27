import { type Locator, type Page } from '@playwright/test';
/** Canvas-size button in the canvas header. */
export declare const canvasSizeButton: (page: Page) => Locator;
/** The canvas-size popover (role=dialog). */
export declare const canvasSizePopover: (page: Page) => Locator;
/**
 * Open the canvas-size popover and click the named breakpoint preset.
 * The popover doesn't auto-close on selection (so the user can
 * compare widths) — we send Escape so specs leave the popover closed
 * and the next interaction doesn't get intercepted.
 */
export declare const switchBreakpoint: (page: Page, bpId: "desktop" | "tablet" | "mobile" | string, visibleLabel: string) => Promise<void>;
/**
 * Open the project-settings full-page overlay via the element toolbar.
 * The floating toolbar's "Settings" button is the trigger — there's no
 * other visible "Settings" button inside an open project.
 */
export declare const openProjectSettings: (page: Page) => Promise<void>;
/** Close the project-settings page via its Back button. */
export declare const closeProjectSettings: (page: Page) => Promise<void>;
