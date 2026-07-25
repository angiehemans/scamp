import {
  makeFrTracks,
  parseGridTemplate,
  serializeGridTemplate,
} from '@lib/gridTemplate';

import { GridQuickSize } from './GridQuickSize';
import { GridTrackList } from './GridTrackList';
import styles from './GridTemplateEditor.module.css';

type Props = {
  columns: string;
  rows: string;
  onChange: (patch: {
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
  }) => void;
};

/**
 * Visual builder for `grid-template-columns` / `-rows`. A quick N×M
 * matrix picker seeds the grid with equal `fr` tracks; the per-axis
 * track lists then tune each track (size + type, add/remove). The
 * store keeps the raw CSS strings — this is only an editing lens (see
 * `@lib/gridTemplate`).
 */
export const GridTemplateEditor = ({
  columns,
  rows,
  onChange,
}: Props): JSX.Element => {
  // Reflect the element's current track counts in the quick picker so
  // the chosen size stays highlighted until the user changes it.
  const selectedCols = parseGridTemplate(columns)?.length ?? 0;
  const selectedRows = parseGridTemplate(rows)?.length ?? 0;

  return (
    <div className={styles.editor}>
      <GridQuickSize
        selectedCols={selectedCols}
        selectedRows={selectedRows}
        onPick={(cols, rowCount) =>
          onChange({
            gridTemplateColumns: serializeGridTemplate(makeFrTracks(cols)),
            gridTemplateRows: serializeGridTemplate(makeFrTracks(rowCount)),
          })
        }
      />
      <GridTrackList
        label="Columns"
        template={columns}
        onChange={(next) => onChange({ gridTemplateColumns: next })}
      />
      <GridTrackList
        label="Rows"
        template={rows}
        onChange={(next) => onChange({ gridTemplateRows: next })}
      />
    </div>
  );
};
