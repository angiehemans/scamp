import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './ZoomControls.module.css';
/**
 * Compact zoom indicator + buttons for the toolbar header.
 *
 * - Shows the current zoom percentage when the user has set an explicit
 *   zoom (via Cmd+= / Cmd+- or the buttons).
 * - Shows "Fit" when the viewport is in auto-fit-to-container mode.
 * - Clicking the percentage label resets to fit. The minus and plus
 *   buttons walk the discrete zoom ladder up and down.
 */
export const ZoomControls = () => {
    const userZoom = useCanvasStore((s) => s.userZoom);
    const fitScale = useCanvasStore((s) => s.fitScale);
    const zoomIn = useCanvasStore((s) => s.zoomIn);
    const zoomOut = useCanvasStore((s) => s.zoomOut);
    const resetZoom = useCanvasStore((s) => s.resetZoom);
    const setZoom = useCanvasStore((s) => s.setZoom);
    const label = userZoom === null ? 'Fit' : `${Math.round(userZoom * 100)}%`;
    // Real rendered percentage — resolves the "Fit" label to a number on
    // hover so the user can see what auto-fit actually scaled to.
    const effectivePct = Math.round((userZoom ?? fitScale) * 100);
    // The label toggles between fit and 100%: in fit mode a click jumps to
    // 100% (what the "click …" hint promises); in explicit mode it returns
    // to fit. Clicking used to be a no-op in fit mode, which the tooltip
    // wording misleadingly implied would do something.
    const inFitMode = userZoom === null;
    const labelTooltip = inFitMode
        ? `Fit · ${effectivePct}% — click for 100%`
        : `${effectivePct}% — click to fit`;
    const handleLabelClick = () => {
        if (inFitMode)
            setZoom(1);
        else
            resetZoom();
    };
    return (_jsxs("div", { className: styles.controls, children: [_jsx(Tooltip, { label: "Zoom out (Ctrl/Cmd+-)", children: _jsx("button", { "aria-label": "Zoom out", className: styles.button, onClick: () => zoomOut(), type: "button", children: "\u2212" }) }), _jsx(Tooltip, { label: labelTooltip, children: _jsx("button", { "aria-label": labelTooltip, className: styles.label, onClick: handleLabelClick, type: "button", children: label }) }), _jsx(Tooltip, { label: "Zoom in (Ctrl/Cmd+=)", children: _jsx("button", { "aria-label": "Zoom in", className: styles.button, onClick: () => zoomIn(), type: "button", children: "+" }) })] }));
};
