import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cellToFlexAlign, flexAlignToCell, } from '@lib/alignmentGrid';
import { Tooltip } from './Tooltip';
import styles from './AlignmentGrid.module.css';
const INDICES = [0, 1, 2];
const H_LABEL = ['left', 'center', 'right'];
const V_LABEL = ['top', 'middle', 'bottom'];
/**
 * Three "content" bars of distinct lengths so the box reads like real
 * items — the way Figma's alignment preview does (roughly a 4 : 6 : 3
 * ratio). The varying dimension is the CROSS axis (heights for a row,
 * widths for a column), so the alignment you pick visibly aligns
 * bars of different sizes. Tweak these freely.
 */
const BAR_LENGTHS = ['18%', '25%', '12%'];
/** Uniform thickness along the layout's main axis (px). */
const BAR_THICKNESS = 3;
/**
 * A 3×3 alignment picker (Figma-style). Clicking a cell packs the
 * element to that corner/edge/center by setting both `alignItems` and
 * `justifyContent`. The preview bars mirror the element's ACTUAL values
 * — including `space-*` / `stretch`, which the grid can't pin to a
 * single cell (those are still editable via the dropdowns below it).
 */
export const AlignmentGrid = ({ direction, alignItems, justifyContent, onChange, }) => {
    const active = flexAlignToCell(alignItems, justifyContent, direction);
    const stretched = alignItems === 'stretch';
    // The preview is just a real flex box with a small inset (see
    // `.preview`), so the bars justify / align exactly like real flex
    // children: flush to the edge for start / end, centred for center,
    // spread for space-*, filling for stretch.
    const previewStyle = {
        flexDirection: direction,
        justifyContent,
        alignItems,
    };
    // Each bar keeps a fixed length along the CROSS axis (the alignment
    // axis) and a uniform thickness along the main axis. `stretch`
    // overrides the cross length so bars fill it, matching real flex.
    const barStyle = (length) => direction === 'row'
        ? { width: BAR_THICKNESS, height: stretched ? '100%' : length }
        : { height: BAR_THICKNESS, width: stretched ? '100%' : length };
    return (_jsx(Tooltip, { label: "Alignment \u2014 double-click for space-between", children: _jsxs("div", { className: styles.grid, role: "group", "aria-label": "Alignment", 
            // Double-clicking the whole control is a quick shortcut to
            // distribute children with space-between (keeps the cross-axis
            // alignment the user already has).
            onDoubleClick: () => onChange({ alignItems, justifyContent: 'space-between' }), children: [_jsx("div", { className: styles.preview, style: previewStyle, "aria-hidden": true, children: BAR_LENGTHS.map((length, i) => (
                    // eslint-disable-next-line react/no-array-index-key -- fixed 3-bar preview
                    _jsx("span", { className: styles.bar, style: barStyle(length) }, i))) }), INDICES.map((row) => INDICES.map((col) => {
                    const isActive = active !== null && active.col === col && active.row === row;
                    return (_jsx("button", { type: "button", className: `${styles.cell} ${isActive ? styles.cellActive : ''}`, "aria-label": `Align ${V_LABEL[row]} ${H_LABEL[col]}`, "aria-pressed": isActive, onClick: () => onChange(cellToFlexAlign(col, row, direction)), children: _jsx("span", { className: styles.dot, "aria-hidden": true }) }, `${col}-${row}`));
                }))] }) }));
};
