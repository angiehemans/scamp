import type { CSSProperties } from 'react';

import {
  cellToFlexAlign,
  flexAlignToCell,
  type CellIndex,
} from '@lib/alignmentGrid';
import type { AlignItems, FlexDirection, JustifyContent } from '@lib/element';

import { Tooltip } from './Tooltip';
import styles from './AlignmentGrid.module.css';

type Props = {
  direction: FlexDirection;
  alignItems: AlignItems;
  justifyContent: JustifyContent;
  onChange: (patch: {
    alignItems: AlignItems;
    justifyContent: JustifyContent;
  }) => void;
};

const INDICES: readonly CellIndex[] = [0, 1, 2];
const H_LABEL = ['left', 'center', 'right'] as const;
const V_LABEL = ['top', 'middle', 'bottom'] as const;

/**
 * Three "content" bars of distinct lengths, so the preview reads like real
 * items rather than a symmetric ornament. Fixed px rather than percentages:
 * these sizes come from the design and shouldn't change with the control's
 * width.
 */
const BAR_LENGTHS = [10, 14, 8] as const;
/** Uniform thickness across each bar's short edge. */
const BAR_THICKNESS = 3;
/**
 * The band the bars align inside — the longest bar.
 *
 * Fixing it (rather than letting the group be `fit-content`) is what keeps
 * the three bars on a shared baseline. It matters most for `space-between`,
 * where each bar sits in its own cell and would otherwise centre
 * independently, breaking the top/bottom alignment the setting describes.
 */
const BAND = Math.max(...BAR_LENGTHS);
/** The column stack is tighter than the row — straight from the design. */
const GAP_ROW = 4;
const GAP_COLUMN = 3;

/** Where the bars sit along the main axis. */
type MainPlacement = CellIndex | 'distributed';
/** Where they sit along the cross axis. */
type CrossPlacement = CellIndex | 'stretch';

const PACKED = ['flex-start', 'center', 'flex-end'] as const;

const mainPlacement = (justifyContent: JustifyContent): MainPlacement => {
  const i = PACKED.indexOf(justifyContent as (typeof PACKED)[number]);
  // `space-around` gets the same three-across treatment as `space-between`:
  // with one bar centred per cell on a 3×3 grid the two are visually
  // identical, and the dropdown still carries the exact value.
  return i === -1 ? 'distributed' : (i as CellIndex);
};

const crossPlacement = (alignItems: AlignItems): CrossPlacement => {
  const i = PACKED.indexOf(alignItems as (typeof PACKED)[number]);
  return i === -1 ? 'stretch' : (i as CellIndex);
};

/**
 * A 3×3 alignment picker (Figma-style). Clicking a cell packs the element to
 * that corner/edge/center by setting both `alignItems` and `justifyContent`.
 *
 * The bars render INSIDE the cell they describe, as grid items sharing that
 * cell's tracks — not as an overlay stretched across the whole control. That
 * is what makes them line up with the dots for free: the cell centres them,
 * so there is no geometry to hand-tune.
 * see docs/notes/alignment-grid.md
 */
export const AlignmentGrid = ({
  direction,
  alignItems,
  justifyContent,
  onChange,
}: Props): JSX.Element => {
  const active = flexAlignToCell(alignItems, justifyContent, direction);
  const isRow = direction === 'row';
  const main = mainPlacement(justifyContent);
  const cross = crossPlacement(alignItems);
  const stretched = cross === 'stretch';

  /** Main-axis positions carrying bars: one when packed, all three when not. */
  const mainSlots: CellIndex[] = main === 'distributed' ? [0, 1, 2] : [main];

  /** True when this cell shows bars, and so hides its dot. */
  const showsBars = (col: CellIndex, row: CellIndex): boolean => {
    const mainPos = isRow ? col : row;
    const crossPos = isRow ? row : col;
    if (!mainSlots.includes(mainPos)) return false;
    return stretched || crossPos === cross;
  };

  /** Grid placement for one bar group. Stretch spans the whole cross axis. */
  const groupStyle = (mainPos: CellIndex): CSSProperties => {
    const crossTrack = stretched ? '1 / -1' : `${(cross as number) + 1}`;
    return isRow
      ? { gridColumn: `${mainPos + 1}`, gridRow: crossTrack }
      : { gridRow: `${mainPos + 1}`, gridColumn: crossTrack };
  };

  const bandStyle: CSSProperties = {
    flexDirection: direction,
    gap: isRow ? GAP_ROW : GAP_COLUMN,
    alignItems: stretched ? 'stretch' : alignItems,
    ...(isRow
      ? { height: stretched ? '100%' : BAND }
      : { width: stretched ? '100%' : BAND }),
  };

  const barStyle = (length: number): CSSProperties =>
    isRow
      ? { width: BAR_THICKNESS, height: stretched ? '100%' : length }
      : { height: BAR_THICKNESS, width: stretched ? '100%' : length };

  return (
    <Tooltip label="Alignment — double-click for space-between">
      <div
        className={styles.grid}
        role="group"
        aria-label="Alignment"
        // Double-clicking the whole control is a quick shortcut to
        // distribute children with space-between (keeps the cross-axis
        // alignment the user already has).
        onDoubleClick={() =>
          onChange({ alignItems, justifyContent: 'space-between' })
        }
      >
        {INDICES.map((row) =>
          INDICES.map((col) => {
            const isActive =
              active !== null && active.col === col && active.row === row;
            return (
              <button
                type="button"
                key={`${col}-${row}`}
                className={styles.cell}
                // Explicit placement, because the bar groups below are
                // explicitly placed too: grid auto-placement puts positioned
                // items down first, so auto-placed cells would flow around
                // them into a fourth row.
                style={{ gridColumn: `${col + 1}`, gridRow: `${row + 1}` }}
                aria-label={`Align ${V_LABEL[row]} ${H_LABEL[col]}`}
                aria-pressed={isActive}
                onClick={() => onChange(cellToFlexAlign(col, row, direction))}
              >
                {/* Bars replace the dot in the cells they occupy. */}
                {!showsBars(col, row) && (
                  <span
                    className={styles.dot}
                    aria-hidden
                    data-align-dot={`${col}-${row}`}
                  />
                )}
              </button>
            );
          })
        )}

        {/* Bar groups occupy the same grid tracks as the cells, so they land
            on the cell exactly. Rendered after the cells so they paint above,
            and click straight through to them. */}
        {mainSlots.map((mainPos) => (
          <span
            key={`bars-${mainPos}`}
            className={styles.barGroup}
            style={groupStyle(mainPos)}
            aria-hidden
          >
            <span className={styles.band} style={bandStyle}>
              {(main === 'distributed'
                ? [BAR_LENGTHS[mainPos] ?? BAND]
                : [...BAR_LENGTHS]
              ).map((length, i) => (
                // eslint-disable-next-line react/no-array-index-key -- fixed bar list
                <span
                  key={i}
                  className={styles.bar}
                  style={barStyle(length)}
                  data-align-bar={main === 'distributed' ? mainPos : i}
                />
              ))}
            </span>
          </span>
        ))}
      </div>
    </Tooltip>
  );
};
