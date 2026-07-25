import type { AlignItems, FlexDirection, JustifyContent } from './element';
/** Grid coordinate: 0 = first, 1 = middle, 2 = last. */
export type CellIndex = 0 | 1 | 2;
export type GridCell = {
    col: CellIndex;
    row: CellIndex;
};
/**
 * Map a clicked cell to the flex alignment it represents. Axis
 * assignment flips with `direction`:
 *   - row:    horizontal (col) = justify (main), vertical (row) = align (cross)
 *   - column: vertical (row) = justify (main), horizontal (col) = align (cross)
 */
export declare const cellToFlexAlign: (col: CellIndex, row: CellIndex, direction: FlexDirection) => {
    alignItems: AlignItems;
    justifyContent: JustifyContent;
};
/**
 * Inverse of `cellToFlexAlign`: which cell (if any) the current values
 * correspond to. Returns null when either axis holds a value the grid
 * can't represent (`space-between` / `space-around` on justify,
 * `stretch` on align) — the caller then shows no active cell and lets
 * the dropdowns carry the value.
 */
export declare const flexAlignToCell: (alignItems: AlignItems, justifyContent: JustifyContent, direction: FlexDirection) => GridCell | null;
