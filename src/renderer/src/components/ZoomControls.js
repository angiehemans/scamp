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
    const zoomIn = useCanvasStore((s) => s.zoomIn);
    const zoomOut = useCanvasStore((s) => s.zoomOut);
    const resetZoom = useCanvasStore((s) => s.resetZoom);
    const label = userZoom === null ? 'Fit' : `${Math.round(userZoom * 100)}%`;
    return (_jsxs("div", { className: styles.controls, children: [_jsx(Tooltip, { label: "Zoom out (Ctrl/Cmd+-)", children: _jsx("button", { className: styles.button, onClick: () => zoomOut(), type: "button", children: "\u2212" }) }), _jsx(Tooltip, { label: "Reset zoom to fit (Ctrl/Cmd+0)", children: _jsx("button", { className: styles.label, onClick: () => resetZoom(), type: "button", children: label }) }), _jsx(Tooltip, { label: "Zoom in (Ctrl/Cmd+=)", children: _jsx("button", { className: styles.button, onClick: () => zoomIn(), type: "button", children: "+" }) })] }));
};
