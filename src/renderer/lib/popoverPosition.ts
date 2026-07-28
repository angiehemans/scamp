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
  /**
   * When set, and neither below nor above can show the popover at its full
   * `desiredMaxHeight`, overlay it centered on the trigger so it uses the
   * full usable window height instead of being cramped to one side. For
   * fixed-height content (e.g. a color picker) that reads better centered
   * over the cursor than clipped short. Off by default (menus still dock).
   */
  overlayWhenTight?: boolean;
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

export const computePopoverPosition = (
  triggerRect: DOMRect,
  options: PopoverPositionOptions,
  viewport: { width: number; height: number; top?: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
): PopoverPosition => {
  const { width, desiredMaxHeight, align } = options;
  const gap = options.gap ?? 4;
  const edgeMargin = options.edgeMargin ?? 8;
  const minFitBelow = options.minFitBelow ?? 120;

  // `viewport.top` is the top inset of the usable area — the app's custom
  // title bar sits above it (see docs/notes/title-bar.md). Space above the
  // trigger is measured from there, not the raw window top, so a flipped-up
  // popover's `maxHeight` keeps it clear of the title bar / window edge.
  const usableTop = (viewport.top ?? 0) + edgeMargin;

  const spaceBelow = viewport.height - triggerRect.bottom - edgeMargin - gap;
  const spaceAbove = triggerRect.top - gap - usableTop;
  const placedAbove = spaceBelow < minFitBelow && spaceAbove > spaceBelow;

  // Horizontal placement.
  let left: number;
  if (align === 'right') {
    left = triggerRect.right - width;
  } else if (align === 'center') {
    left = triggerRect.left + triggerRect.width / 2 - width / 2;
  } else {
    left = triggerRect.left;
  }
  if (left < edgeMargin) left = edgeMargin;
  if (left + width > viewport.width - edgeMargin) {
    left = viewport.width - width - edgeMargin;
  }

  // Overlay-centered fallback: when neither side fits the full desired
  // height, center the popover on the trigger within the usable viewport so
  // it gets the whole window height rather than a cramped one-sided slice.
  if (options.overlayWhenTight) {
    const usableBottom = viewport.height - edgeMargin;
    const usableHeight = usableBottom - usableTop;
    const fitsOneSide =
      spaceBelow >= desiredMaxHeight || spaceAbove >= desiredMaxHeight;
    if (!fitsOneSide && usableHeight > Math.max(spaceBelow, spaceAbove)) {
      const maxHeight = Math.max(0, Math.min(desiredMaxHeight, usableHeight));
      const triggerCenter = triggerRect.top + triggerRect.height / 2;
      let top = triggerCenter - maxHeight / 2;
      if (top < usableTop) top = usableTop;
      if (top + maxHeight > usableBottom) top = usableBottom - maxHeight;
      return { left, top, width, maxHeight, placedAbove: false };
    }
  }

  if (placedAbove) {
    const maxHeight = Math.max(0, Math.min(desiredMaxHeight, spaceAbove));
    // Anchor by bottom: the popover's bottom edge sits `gap` above the
    // trigger's top, regardless of the popover's actual content height.
    const bottom = viewport.height - triggerRect.top + gap;
    return { left, bottom, width, maxHeight, placedAbove: true };
  }

  const maxHeight = Math.max(0, Math.min(desiredMaxHeight, spaceBelow));
  return {
    left,
    top: triggerRect.bottom + gap,
    width,
    maxHeight,
    placedAbove: false,
  };
};
