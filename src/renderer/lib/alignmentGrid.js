/**
 * The three packed values, ordered to match grid indices 0/1/2. Flex
 * uses the `flex-*` spelling on both axes.
 */
const PACKED = ['flex-start', 'center', 'flex-end'];
/** Index (0/1/2) of a packed value, or null for space / stretch values. */
const packedIndex = (value) => {
    const i = PACKED.indexOf(value);
    return i === -1 ? null : i;
};
/**
 * Map a clicked cell to the flex alignment it represents. Axis
 * assignment flips with `direction`:
 *   - row:    horizontal (col) = justify (main), vertical (row) = align (cross)
 *   - column: vertical (row) = justify (main), horizontal (col) = align (cross)
 */
export const cellToFlexAlign = (col, row, direction) => {
    if (direction === 'column') {
        return { justifyContent: PACKED[row], alignItems: PACKED[col] };
    }
    return { justifyContent: PACKED[col], alignItems: PACKED[row] };
};
/**
 * Inverse of `cellToFlexAlign`: which cell (if any) the current values
 * correspond to. Returns null when either axis holds a value the grid
 * can't represent (`space-between` / `space-around` on justify,
 * `stretch` on align) — the caller then shows no active cell and lets
 * the dropdowns carry the value.
 */
export const flexAlignToCell = (alignItems, justifyContent, direction) => {
    const alignIdx = packedIndex(alignItems);
    const justifyIdx = packedIndex(justifyContent);
    if (alignIdx === null || justifyIdx === null)
        return null;
    if (direction === 'column') {
        return { col: alignIdx, row: justifyIdx };
    }
    return { col: justifyIdx, row: alignIdx };
};
