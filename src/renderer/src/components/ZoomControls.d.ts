/**
 * Compact zoom indicator + buttons for the toolbar header.
 *
 * - Shows the current zoom percentage when the user has set an explicit
 *   zoom (via Cmd+= / Cmd+- or the buttons).
 * - Shows "Fit" when the viewport is in auto-fit-to-container mode.
 * - Clicking the percentage label resets to fit. The minus and plus
 *   buttons walk the discrete zoom ladder up and down.
 */
export declare const ZoomControls: () => JSX.Element;
