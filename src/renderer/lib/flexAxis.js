/**
 * Axis helpers for the four-value `flex-direction`.
 *
 * `row-reverse` is still a horizontal main axis — only the order flips —
 * so anything that reasons about "which axis is main" must ask these
 * rather than compare against `'column'` or `'row'` directly.
 */
/** True when the main axis is vertical. `undefined` (no parent) reads as row. */
export const isColumnDirection = (direction) => direction === 'column' || direction === 'column-reverse';
export const isReverseDirection = (direction) => direction === 'row-reverse' || direction === 'column-reverse';
/** The plain axis, with any `-reverse` dropped. */
export const baseDirection = (direction) => isColumnDirection(direction) ? 'column' : 'row';
/** Re-apply (or strip) the reverse modifier on a base axis. */
export const withReverse = (base, reverse) => (reverse ? `${base}-reverse` : base);
/**
 * The `align-self` spelling for a given parent. The field stores the short
 * form; a flex parent gets `flex-start` / `flex-end` to match the
 * container's own `align-items`, a grid parent keeps `start` / `end`.
 */
export const selfAlignForParent = (value, parentDisplay) => {
    if (parentDisplay !== 'flex')
        return value;
    if (value === 'start')
        return 'flex-start';
    if (value === 'end')
        return 'flex-end';
    return value;
};
