import { isZeroSpaceValue } from './spaceValue';
/** True when either per-axis field carries a value of its own. */
export const hasAxisGaps = (el) => !isZeroSpaceValue(el.columnGap) || !isZeroSpaceValue(el.rowGap);
/** What each axis input should display: its own value, else `gap`. */
export const effectiveAxisGaps = (el) => ({
    columnGap: isZeroSpaceValue(el.columnGap) ? el.gap : el.columnGap,
    rowGap: isZeroSpaceValue(el.rowGap) ? el.gap : el.rowGap,
});
/** The patch for editing one axis, expanding a lone `gap` on the way. */
export const axisGapPatch = (el, axis, value) => {
    if (!hasAxisGaps(el) && !isZeroSpaceValue(el.gap)) {
        const eff = effectiveAxisGaps(el);
        return { columnGap: eff.columnGap, rowGap: eff.rowGap, gap: 0, [axis]: value };
    }
    return { [axis]: value };
};
