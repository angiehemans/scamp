import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { DESKTOP_BREAKPOINT_ID, MAX_CANVAS_WIDTH, MIN_CANVAS_WIDTH, } from '@shared/types';
import { clampCanvasWidth } from '@shared/projectConfig';
import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from './controls/NumberInput';
import { Tooltip } from './controls/Tooltip';
import styles from './CanvasSizeControl.module.css';
/**
 * Toolbar control for the canvas viewport size + active breakpoint.
 *
 * The button's label reflects the active breakpoint (or a custom-
 * width readout when no preset matches). Clicking opens a popover
 * with:
 *   - A segmented list of the project's breakpoints. Clicking one
 *     sets canvas width AND active breakpoint — so subsequent
 *     property-panel edits land inside that breakpoint's @media
 *     block.
 *   - A custom-width input. Typing a value that doesn't match any
 *     breakpoint drops the active breakpoint to `desktop` so edits
 *     apply to the base CSS.
 *   - An overflow-hidden toggle (a viewport-frame preview helper,
 *     never written to CSS).
 */
export const CanvasSizeControl = ({ config, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
    const setActiveBreakpoint = useCanvasStore((s) => s.setActiveBreakpoint);
    useEffect(() => {
        if (!open)
            return;
        const handleDocClick = (e) => {
            const node = wrapRef.current;
            if (!node)
                return;
            if (!node.contains(e.target))
                setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', handleDocClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDocClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);
    /** Pick a preset: updates canvas width AND active breakpoint. */
    const selectBreakpoint = (bp) => {
        onChange({ ...config, canvasWidth: clampCanvasWidth(bp.width) });
        setActiveBreakpoint(bp.id);
    };
    const setOverflow = (overflow) => {
        onChange({ ...config, canvasOverflowHidden: overflow });
    };
    const handleCustomChange = (next) => {
        if (next === undefined)
            return;
        const clamped = clampCanvasWidth(next);
        onChange({ ...config, canvasWidth: clamped });
        // A custom width means we're NOT editing a specific breakpoint —
        // drop back to desktop so panel edits target the base CSS.
        const match = config.breakpoints.find((b) => b.width === clamped);
        setActiveBreakpoint(match ? match.id : DESKTOP_BREAKPOINT_ID);
    };
    const activeBreakpoint = config.breakpoints.find((b) => b.id === activeBreakpointId);
    const buttonLabel = activeBreakpoint
        ? `${activeBreakpoint.label} · ${config.canvasWidth}`
        : `${config.canvasWidth}px`;
    return (_jsxs("div", { className: styles.wrap, ref: wrapRef, children: [_jsx(Tooltip, { label: "Canvas width \u00B7 active breakpoint", children: _jsxs("button", { className: styles.button, type: "button", onClick: () => setOpen((v) => !v), "aria-haspopup": "dialog", "aria-expanded": open, "data-testid": "canvas-size-button", "data-active-breakpoint": activeBreakpointId, children: [buttonLabel, _jsx("span", { className: styles.caret, "aria-hidden": "true", children: "\u25BE" })] }) }), open && (_jsxs("div", { className: styles.popover, role: "dialog", "data-testid": "canvas-size-popover", children: [_jsx("div", { className: styles.sectionLabel, children: "Breakpoint" }), _jsx("div", { className: styles.presetGrid, children: config.breakpoints.map((bp) => (_jsxs("button", { className: `${styles.presetButton} ${bp.id === activeBreakpointId ? styles.presetActive : ''}`, type: "button", onClick: () => selectBreakpoint(bp), children: [_jsx("span", { className: styles.presetName, children: bp.label }), _jsx("span", { className: styles.presetWidth, children: bp.width })] }, bp.id))) }), _jsx("div", { className: styles.sectionLabel, children: "Custom width" }), _jsx("div", { className: styles.customRow, children: _jsx(NumberInput, { value: config.canvasWidth, onChange: handleCustomChange, min: MIN_CANVAS_WIDTH, max: MAX_CANVAS_WIDTH, suffix: "px" }) }), _jsxs("label", { className: styles.toggleRow, children: [_jsx("input", { type: "checkbox", checked: config.canvasOverflowHidden, onChange: (e) => setOverflow(e.target.checked) }), _jsx("span", { children: "Overflow hidden" })] })] }))] }));
};
