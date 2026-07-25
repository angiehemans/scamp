import { describe, it, expect } from 'vitest';
import { cellToFlexAlign, flexAlignToCell } from '@lib/alignmentGrid';
import type { CellIndex } from '@lib/alignmentGrid';

/**
 * The 3×3 grid models the nine packed flex positions. Axis assignment
 * flips with flex-direction: for `row` the horizontal axis is
 * justify-content; for `column` it's align-items. Distribution and
 * stretch values have no cell.
 */

const CELLS: CellIndex[] = [0, 1, 2];

describe('cellToFlexAlign', () => {
  it('maps the horizontal axis to justify and vertical to align in a row', () => {
    // Top-left → justify start (col), align start (row).
    expect(cellToFlexAlign(0, 0, 'row')).toEqual({
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    });
    // Middle → both center.
    expect(cellToFlexAlign(1, 1, 'row')).toEqual({
      justifyContent: 'center',
      alignItems: 'center',
    });
    // Bottom-right → justify end (col), align end (row).
    expect(cellToFlexAlign(2, 2, 'row')).toEqual({
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
    });
    // Top-right → justify end (col 2), align start (row 0).
    expect(cellToFlexAlign(2, 0, 'row')).toEqual({
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
    });
  });

  it('flips the axes for a column: vertical is justify, horizontal is align', () => {
    // Top-left → justify start (row 0), align start (col 0).
    expect(cellToFlexAlign(0, 0, 'column')).toEqual({
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    });
    // Top-right → col 2 = align end, row 0 = justify start.
    expect(cellToFlexAlign(2, 0, 'column')).toEqual({
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    });
    // Bottom-left → col 0 = align start, row 2 = justify end.
    expect(cellToFlexAlign(0, 2, 'column')).toEqual({
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
    });
  });
});

describe('flexAlignToCell', () => {
  it('round-trips every packed cell for a row', () => {
    for (const col of CELLS) {
      for (const row of CELLS) {
        const { alignItems, justifyContent } = cellToFlexAlign(col, row, 'row');
        expect(flexAlignToCell(alignItems, justifyContent, 'row')).toEqual({
          col,
          row,
        });
      }
    }
  });

  it('round-trips every packed cell for a column', () => {
    for (const col of CELLS) {
      for (const row of CELLS) {
        const { alignItems, justifyContent } = cellToFlexAlign(
          col,
          row,
          'column'
        );
        expect(flexAlignToCell(alignItems, justifyContent, 'column')).toEqual({
          col,
          row,
        });
      }
    }
  });

  it('returns null when justify is a distribution value', () => {
    expect(flexAlignToCell('center', 'space-between', 'row')).toBeNull();
    expect(flexAlignToCell('center', 'space-around', 'row')).toBeNull();
    expect(flexAlignToCell('center', 'space-between', 'column')).toBeNull();
  });

  it('returns null when align is stretch', () => {
    expect(flexAlignToCell('stretch', 'center', 'row')).toBeNull();
    expect(flexAlignToCell('stretch', 'flex-start', 'column')).toBeNull();
  });
});
