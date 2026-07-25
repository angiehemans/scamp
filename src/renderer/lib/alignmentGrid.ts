// @lib/alignmentGrid.ts — pure mapping between a Figma-style 3×3 flex
// alignment grid and the element's `alignItems` / `justifyContent`
// fields. Kept UI-free so it's unit-testable (see test/alignmentGrid.test.ts).
//
// The grid only models the nine PACKED positions (start/center/end on
// each axis). Distribution (`space-between` / `space-around`) and
// `stretch` have no cell — the panel keeps its dropdowns for those.
import type { AlignItems, FlexDirection, JustifyContent } from './element';

/** Grid coordinate: 0 = first, 1 = middle, 2 = last. */
export type CellIndex = 0 | 1 | 2;

export type GridCell = { col: CellIndex; row: CellIndex };

/**
 * The three packed values, ordered to match grid indices 0/1/2. Flex
 * uses the `flex-*` spelling on both axes.
 */
const PACKED: readonly [
  'flex-start',
  'center',
  'flex-end',
] = ['flex-start', 'center', 'flex-end'];

/** Index (0/1/2) of a packed value, or null for space / stretch values. */
const packedIndex = (value: string): CellIndex | null => {
  const i = PACKED.indexOf(value as (typeof PACKED)[number]);
  return i === -1 ? null : (i as CellIndex);
};

/**
 * Map a clicked cell to the flex alignment it represents. Axis
 * assignment flips with `direction`:
 *   - row:    horizontal (col) = justify (main), vertical (row) = align (cross)
 *   - column: vertical (row) = justify (main), horizontal (col) = align (cross)
 */
export const cellToFlexAlign = (
  col: CellIndex,
  row: CellIndex,
  direction: FlexDirection
): { alignItems: AlignItems; justifyContent: JustifyContent } => {
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
export const flexAlignToCell = (
  alignItems: AlignItems,
  justifyContent: JustifyContent,
  direction: FlexDirection
): GridCell | null => {
  const alignIdx = packedIndex(alignItems);
  const justifyIdx = packedIndex(justifyContent);
  if (alignIdx === null || justifyIdx === null) return null;
  if (direction === 'column') {
    return { col: alignIdx, row: justifyIdx };
  }
  return { col: justifyIdx, row: alignIdx };
};
