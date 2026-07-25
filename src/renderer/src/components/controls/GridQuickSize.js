import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Tooltip } from './Tooltip';
import styles from './GridTemplateEditor.module.css';
/**
 * A hover-to-size N×M matrix (Notion / Figma "insert table" style).
 * Hovering highlights the rectangle from the top-left to the hovered
 * cell; clicking commits that many columns × rows. With no hover, the
 * element's current dimensions stay highlighted.
 */
export const GridQuickSize = ({ maxCols = 6, maxRows = 6, selectedCols = 0, selectedRows = 0, onPick, }) => {
    const [hover, setHover] = useState(null);
    const cols = Array.from({ length: maxCols }, (_, i) => i);
    const rows = Array.from({ length: maxRows }, (_, i) => i);
    // The rectangle to highlight: the hover target, else the current
    // selection (as a 0-based bottom-right corner).
    const marked = hover ??
        (selectedCols > 0 && selectedRows > 0
            ? { col: selectedCols - 1, row: selectedRows - 1 }
            : null);
    return (_jsx(Tooltip, { label: "Quick grid size \u2014 click to set columns \u00D7 rows", children: _jsxs("div", { className: styles.quick, children: [_jsx("div", { className: styles.quickGrid, style: { gridTemplateColumns: `repeat(${maxCols}, 14px)` }, onMouseLeave: () => setHover(null), children: rows.map((row) => cols.map((col) => {
                        const active = marked !== null && col <= marked.col && row <= marked.row;
                        return (_jsx("button", { type: "button", className: `${styles.quickCell} ${active ? styles.quickCellActive : ''}`, "aria-label": `${col + 1} by ${row + 1} grid`, onMouseEnter: () => setHover({ col, row }), onFocus: () => setHover({ col, row }), onClick: () => onPick(col + 1, row + 1) }, `${col}-${row}`));
                    })) }), _jsx("span", { className: styles.quickLabel, children: marked !== null
                        ? `${marked.col + 1} × ${marked.row + 1}`
                        : 'Pick a grid size' })] }) }));
};
