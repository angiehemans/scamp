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
 * Three "content" bars of distinct lengths so the box reads like real
 * items — the way Figma's alignment preview does (roughly a 4 : 6 : 3
 * ratio). The varying dimension is the CROSS axis (heights for a row,
 * widths for a column), so the alignment you pick visibly aligns
 * bars of different sizes. Tweak these freely.
 */
const BAR_LENGTHS = ['25%', '33%', '18%'] as const;
/** Uniform thickness along the layout's main axis (px). */
const BAR_THICKNESS = 3;

/**
 * A 3×3 alignment picker (Figma-style). Clicking a cell packs the
 * element to that corner/edge/center by setting both `alignItems` and
 * `justifyContent`. The preview bars mirror the element's ACTUAL values
 * — including `space-*` / `stretch`, which the grid can't pin to a
 * single cell (those are still editable via the dropdowns below it).
 */
export const AlignmentGrid = ({
  direction,
  alignItems,
  justifyContent,
  onChange,
}: Props): JSX.Element => {
  const active = flexAlignToCell(alignItems, justifyContent, direction);
  const stretched = alignItems === 'stretch';

  // The preview is a real flex box, so `space-between` / `space-around`
  // / `stretch` render exactly as they will on the canvas.
  const previewStyle: CSSProperties = {
    flexDirection: direction,
    alignItems,
    justifyContent,
  };
  // Each bar keeps a fixed length along the CROSS axis (the alignment
  // axis) and a uniform thickness along the main axis. `stretch`
  // overrides the cross length so bars fill it, matching real flex.
  const barStyle = (length: string): CSSProperties =>
    direction === 'row'
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
        <div className={styles.preview} style={previewStyle} aria-hidden>
          {BAR_LENGTHS.map((length, i) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed 3-bar preview
            <span key={i} className={styles.bar} style={barStyle(length)} />
          ))}
        </div>
        {INDICES.map((row) =>
          INDICES.map((col) => {
            const isActive =
              active !== null && active.col === col && active.row === row;
            return (
              <button
                type="button"
                key={`${col}-${row}`}
                className={`${styles.cell} ${isActive ? styles.cellActive : ''}`}
                aria-label={`Align ${V_LABEL[row]} ${H_LABEL[col]}`}
                aria-pressed={isActive}
                onClick={() => onChange(cellToFlexAlign(col, row, direction))}
              >
                <span className={styles.dot} aria-hidden />
              </button>
            );
          })
        )}
      </div>
    </Tooltip>
  );
};
