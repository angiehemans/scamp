// Pure placement decision for the hover Tooltip. Extracted from the
// component so the "is there room above?" logic is unit-testable
// (see test/tooltipPlacement.test.ts).
/** Vertical gap between the trigger and the tooltip bubble, in px. */
export const TOOLTIP_GAP = 10;
/**
 * Decide whether a tooltip should render above or below its trigger.
 *
 * Defaults to `'top'` (the historical behavior), but flips to `'bottom'`
 * when the trigger sits too close to the top edge for the bubble to fit —
 * this is what keeps the top toolbar's tooltips from clipping off-screen.
 * A forced `preferred` of `'top'`/`'bottom'` short-circuits the auto check.
 */
export const resolveTooltipPlacement = (triggerTop, tipHeight, preferred = 'auto', gap = TOOLTIP_GAP) => {
    if (preferred !== 'auto')
        return preferred;
    return triggerTop < tipHeight + gap ? 'bottom' : 'top';
};
