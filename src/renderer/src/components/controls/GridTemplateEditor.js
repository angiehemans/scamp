import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { makeFrTracks, parseGridTemplate, serializeGridTemplate, } from '@lib/gridTemplate';
import { GridQuickSize } from './GridQuickSize';
import { GridTrackList } from './GridTrackList';
import styles from './GridTemplateEditor.module.css';
/**
 * Visual builder for `grid-template-columns` / `-rows`. A quick N×M
 * matrix picker seeds the grid with equal `fr` tracks; the per-axis
 * track lists then tune each track (size + type, add/remove). The
 * store keeps the raw CSS strings — this is only an editing lens (see
 * `@lib/gridTemplate`).
 */
export const GridTemplateEditor = ({ columns, rows, onChange, }) => {
    // Reflect the element's current track counts in the quick picker so
    // the chosen size stays highlighted until the user changes it.
    const selectedCols = parseGridTemplate(columns)?.length ?? 0;
    const selectedRows = parseGridTemplate(rows)?.length ?? 0;
    return (_jsxs("div", { className: styles.editor, children: [_jsx(GridQuickSize, { selectedCols: selectedCols, selectedRows: selectedRows, onPick: (cols, rowCount) => onChange({
                    gridTemplateColumns: serializeGridTemplate(makeFrTracks(cols)),
                    gridTemplateRows: serializeGridTemplate(makeFrTracks(rowCount)),
                }) }), _jsx(GridTrackList, { label: "Columns", template: columns, onChange: (next) => onChange({ gridTemplateColumns: next }) }), _jsx(GridTrackList, { label: "Rows", template: rows, onChange: (next) => onChange({ gridTemplateRows: next }) })] }));
};
