import type { ScampElement } from './element';
import { isZeroSpaceValue, type SpaceValue } from './spaceValue';

/**
 * The Layout section's gap fields for a flex container.
 *
 * The model has all three of `gap`, `columnGap`, `rowGap` and the
 * generator emits each one independently, so a file may hold any mix.
 * The panel shows ONE input when only `gap` is in play and the axis pair
 * when wrapping or when an axis field is already set — and an axis edit
 * on a `gap`-only element expands `gap` into both axes first, so the
 * other axis keeps the value the user was looking at.
 */

type GapFields = Pick<ScampElement, 'gap' | 'columnGap' | 'rowGap'>;

/** True when either per-axis field carries a value of its own. */
export const hasAxisGaps = (el: GapFields): boolean =>
  !isZeroSpaceValue(el.columnGap) || !isZeroSpaceValue(el.rowGap);

/** What each axis input should display: its own value, else `gap`. */
export const effectiveAxisGaps = (
  el: GapFields
): { columnGap: SpaceValue; rowGap: SpaceValue } => ({
  columnGap: isZeroSpaceValue(el.columnGap) ? el.gap : el.columnGap,
  rowGap: isZeroSpaceValue(el.rowGap) ? el.gap : el.rowGap,
});

/** The patch for editing one axis, expanding a lone `gap` on the way. */
export const axisGapPatch = (
  el: GapFields,
  axis: 'columnGap' | 'rowGap',
  value: SpaceValue
): Partial<ScampElement> => {
  if (!hasAxisGaps(el) && !isZeroSpaceValue(el.gap)) {
    const eff = effectiveAxisGaps(el);
    return { columnGap: eff.columnGap, rowGap: eff.rowGap, gap: 0, [axis]: value };
  }
  return { [axis]: value };
};
