import type { ScampElement } from './element';

/**
 * Keeping a drawn box the size it was drawn inside a flex parent.
 *
 * A flex item's default `flex-shrink: 1` lets the layout squash it below
 * its own `width` as soon as the line overflows. So drawing a 180px box
 * into a 600px row that already holds 260 + 260 of children produced a
 * correct `width: 180px` in the CSS and a 148px box on screen — the
 * stylesheet and the render disagreeing, both behaving exactly as CSS
 * says they should.
 *
 * Scamp's promise for the draw tool is that you get the box you drew, so
 * a drawn element in a flex parent opts out of shrinking.
 *
 * This goes through `customProperties` rather than a typed field on
 * purpose. It is emitted verbatim into the generated CSS, so the preview
 * and any browser agree with the canvas; it round-trips through
 * `parseCode` as an unknown property with no new mapping; and it stays
 * visible and removable in the CSS panel for anyone who wants the box to
 * flex after all.
 *
 * see docs/notes/draw-into-flex-parent.md
 */

const FLEX_SHRINK = 'flex-shrink';

/**
 * Add `flex-shrink: 0` when the parent is a flex container.
 *
 * Grid parents are left alone: a grid item is sized by its track and an
 * explicit width is already honoured, so the declaration would be noise.
 *
 * An existing `flex-shrink` is never overwritten — if it is there, either
 * the user or the file it was parsed from meant it.
 */
export const preserveDrawnSize = (
  element: ScampElement,
  parent: ScampElement | undefined
): ScampElement => {
  if (parent?.display !== 'flex') return element;
  if (element.customProperties[FLEX_SHRINK] !== undefined) return element;
  return {
    ...element,
    customProperties: { ...element.customProperties, [FLEX_SHRINK]: '0' },
  };
};

/**
 * The counterpart of `preserveDrawnSize`: give the size BACK to the
 * layout when the user stops fixing it.
 *
 * `flex-shrink: 0` exists to keep a drawn box the size it was drawn.
 * The moment the user switches the parent's MAIN axis to a non-fixed
 * mode — fill, hug, auto — that reason is gone, and the leftover
 * declaration turns actively harmful: `width: 100%` with shrink 0 is
 * basis-100% that cannot shrink, so a "fill width" main panel renders
 * the full container width and overflows past its fixed-width sibling
 * by exactly the sibling's width.
 *
 * Only the main axis matters — flex-shrink has no effect on the cross
 * axis — and only the exact '0' the draw wrote is removed. Any other
 * value was authored deliberately and is left alone.
 */
export const releaseDrawnSize = (
  element: ScampElement,
  parent: ScampElement | undefined,
  patch: Partial<ScampElement>
): Partial<ScampElement> => {
  if (parent?.display !== 'flex') return patch;
  if (element.customProperties[FLEX_SHRINK] !== '0') return patch;
  const mainIsWidth = parent.flexDirection !== 'column';
  const nextMode = mainIsWidth ? patch.widthMode : patch.heightMode;
  if (nextMode === undefined || nextMode === 'fixed') return patch;
  const { [FLEX_SHRINK]: _dropped, ...rest } = element.customProperties;
  return { ...patch, customProperties: rest };
};
