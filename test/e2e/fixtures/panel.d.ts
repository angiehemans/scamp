import type { Locator, Page } from '@playwright/test';
/**
 * Properties panel + canvas helpers used across Phase 3 specs. Keeping
 * these centralized means a layout refactor of the panel only requires
 * changing one file.
 */
/** The right-hand properties panel. */
export declare const propertiesPanel: (page: Page) => Locator;
/** A named `<Section>` inside the properties panel. */
export declare const panelSection: (page: Page, title: string) => Locator;
/**
 * Locate the input row inside a section by its inline prefix label
 * (e.g. "W" for Width, "Sz" for font size, "P" for Padding). Returns
 * the underlying `<input>` so specs can `.fill()`, `.press('Enter')`,
 * read `.inputValue()` etc. `data-prefix` comes from
 * `PrefixSuffixInput`.
 */
export declare const panelInputByPrefix: (page: Page, sectionTitle: string, prefix: string) => Locator;
/**
 * Draw a rectangle on the canvas and return the generated CSS class
 * name of the new rect (e.g. `rect_56a6`). After this call the new
 * rect is auto-selected — its properties-panel sections are live.
 * Caller is responsible for `waitForSaved` before reading disk.
 *
 * Uses `.last()` because canvas DOM is in DFS order, so the most
 * recently drawn rect is always the last match. A plain `.first()`
 * would return the earliest one in subsequent calls.
 */
export declare const drawAndSelectRect: (page: Page, from: {
    x: number;
    y: number;
}, to: {
    x: number;
    y: number;
}) => Promise<string>;
/**
 * Commit an input field by typing a value and pressing Enter. The
 * PrefixSuffixInput used throughout the panel only fires its
 * `onCommit` on Enter or blur.
 */
export declare const commitInput: (input: Locator, value: string) => Promise<void>;
/**
 * Flip the properties panel between Visual and CSS mode.
 */
export declare const setPanelMode: (page: Page, mode: "Visual" | "CSS") => Promise<void>;
