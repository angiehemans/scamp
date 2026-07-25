import { useState } from 'react';

import { Tooltip } from './Tooltip';
import styles from './GridTemplateEditor.module.css';

type Props = {
  /** Grid extent offered in the picker. */
  maxCols?: number;
  maxRows?: number;
  /** The element's current track counts — highlighted when not hovering
   *  so the chosen size persists until changed. 0 = nothing selected. */
  selectedCols?: number;
  selectedRows?: number;
  /** Called with 1-based column/row counts when a cell is clicked. */
  onPick: (cols: number, rows: number) => void;
};

/**
 * A hover-to-size N×M matrix (Notion / Figma "insert table" style).
 * Hovering highlights the rectangle from the top-left to the hovered
 * cell; clicking commits that many columns × rows. With no hover, the
 * element's current dimensions stay highlighted.
 */
export const GridQuickSize = ({
  maxCols = 6,
  maxRows = 6,
  selectedCols = 0,
  selectedRows = 0,
  onPick,
}: Props): JSX.Element => {
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);

  const cols = Array.from({ length: maxCols }, (_, i) => i);
  const rows = Array.from({ length: maxRows }, (_, i) => i);
  // The rectangle to highlight: the hover target, else the current
  // selection (as a 0-based bottom-right corner).
  const marked =
    hover ??
    (selectedCols > 0 && selectedRows > 0
      ? { col: selectedCols - 1, row: selectedRows - 1 }
      : null);

  return (
    <Tooltip label="Quick grid size — click to set columns × rows">
      <div className={styles.quick}>
        <div
          className={styles.quickGrid}
          style={{ gridTemplateColumns: `repeat(${maxCols}, 14px)` }}
          onMouseLeave={() => setHover(null)}
        >
          {rows.map((row) =>
            cols.map((col) => {
              const active =
                marked !== null && col <= marked.col && row <= marked.row;
              return (
                <button
                  type="button"
                  key={`${col}-${row}`}
                  className={`${styles.quickCell} ${active ? styles.quickCellActive : ''}`}
                  aria-label={`${col + 1} by ${row + 1} grid`}
                  onMouseEnter={() => setHover({ col, row })}
                  onFocus={() => setHover({ col, row })}
                  onClick={() => onPick(col + 1, row + 1)}
                />
              );
            })
          )}
        </div>
        <span className={styles.quickLabel}>
          {marked !== null
            ? `${marked.col + 1} × ${marked.row + 1}`
            : 'Pick a grid size'}
        </span>
      </div>
    </Tooltip>
  );
};
