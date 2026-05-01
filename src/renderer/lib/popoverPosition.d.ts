/**
 * Positioning math for anchored popovers (token pickers, dropdown
 * menus, etc.). Pure — give it the trigger's rect and the popover's
 * desired width, get back viewport coordinates + a max-height clamped
 * to the available space. No React, no DOM writes — callers apply
 * the result via inline style or a CSS custom property.
 *
 * Default behaviour:
 *   - Place BELOW the trigger (4px gap).
 *   - Only flip above when there's genuinely no room below — i.e.,
 *     less than MIN_FIT_BELOW pixels, AND above has more room.
 *   - `maxHeight` is the lesser of `desiredMaxHeight` and the real
 *     available space, so a short token list never pushes the popover
 *     into whitespace.
 *   - Horizontal alignment is caller-specified.
 */
export type PopoverAlignment = 'right' | 'left' | 'center';
export type PopoverPositionOptions = {
    width: number;
    /** Preferred max height. Actual height is clamped to available space. */
    desiredMaxHeight: number;
    /** How the popover's horizontal position relates to the trigger. */
    align: PopoverAlignment;
    /** Pixel gap between the trigger and the popover edge. Default 4. */
    gap?: number;
    /** Minimum distance the popover keeps from any viewport edge. Default 8. */
    edgeMargin?: number;
    /**
     * Only flip above the trigger when `spaceBelow` is less than this.
     * Default 120 — lets short menus render below almost always.
     */
    minFitBelow?: number;
};
/**
 * The vertical anchor is either `top` (placed below the trigger) or
 * `bottom` (placed above). Using `bottom` for the above-case lets CSS
 * put the popover's bottom edge right above the trigger regardless of
 * how tall the content actually ends up — no whitespace gap when the
 * popover's content is shorter than `desiredMaxHeight`.
 */
export type PopoverPosition = {
    left: number;
    /** Pixels from the top of the viewport. Undefined when anchored by bottom. */
    top?: number;
    /** Pixels from the bottom of the viewport. Set when the popover is above. */
    bottom?: number;
    width: number;
    maxHeight: number;
    /** True when the popover was flipped to render above the trigger. */
    placedAbove: boolean;
};
export declare const computePopoverPosition: (triggerRect: DOMRect, options: PopoverPositionOptions, viewport?: {
    width: number;
    height: number;
}) => PopoverPosition;
