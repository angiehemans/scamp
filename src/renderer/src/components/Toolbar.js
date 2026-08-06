import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { IconCode, IconPointer, IconSquare, IconLetterT, IconPhoto, IconForms, IconTerminal2, } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './Toolbar.module.css';
const ICON_SIZE = 18;
const TOOLS = [
    { tool: 'select', label: 'Select', shortcut: 'V', icon: _jsx(IconPointer, { size: ICON_SIZE }) },
    { tool: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: _jsx(IconSquare, { size: ICON_SIZE }) },
    { tool: 'text', label: 'Text', shortcut: 'T', icon: _jsx(IconLetterT, { size: ICON_SIZE }) },
    { tool: 'image', label: 'Image', shortcut: 'I', icon: _jsx(IconPhoto, { size: ICON_SIZE }) },
    { tool: 'input', label: 'Input', shortcut: 'F', icon: _jsx(IconForms, { size: ICON_SIZE }) },
];
export const Toolbar = () => {
    const activeTool = useCanvasStore((s) => s.activeTool);
    const setTool = useCanvasStore((s) => s.setTool);
    // Tools are disabled while previewing a snapshot (read-only canvas).
    const isPreviewing = useCanvasStore((s) => s.snapshotPreview !== null);
    useEffect(() => {
        const handleKey = (e) => {
            if (useCanvasStore.getState().snapshotPreview !== null)
                return;
            const target = e.target;
            if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey)
                return;
            if (e.key === 'r' || e.key === 'R')
                setTool('rectangle');
            if (e.key === 'v' || e.key === 'V')
                setTool('select');
            if (e.key === 't' || e.key === 'T')
                setTool('text');
            if (e.key === 'i' || e.key === 'I')
                setTool('image');
            if (e.key === 'f' || e.key === 'F')
                setTool('input');
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [setTool]);
    return (_jsxs("div", { className: styles.toolbar, "data-testid": "element-toolbar", "data-active-tool": activeTool, children: [TOOLS.map((t) => (_jsx(Tooltip, { label: `${t.label} (${t.shortcut})`, children: _jsx("button", { className: `${styles.button} ${activeTool === t.tool ? styles.active : ''}`, onClick: () => setTool(t.tool), type: "button", disabled: isPreviewing, "aria-pressed": activeTool === t.tool, "aria-label": t.label, "data-tool": t.tool, children: t.icon }) }, t.tool))), _jsx("div", { className: styles.spacer }), _jsx(PanelToggles, {})] }));
};
/**
 * Code and terminal toggles, right-aligned on the canvas toolbar.
 *
 * Icon-only: the strip is already dense, and both icons are unambiguous
 * with a tooltip. Reads the store directly rather than taking props —
 * `ProjectShell` → `CanvasArea` → `Toolbar` would be three levels of
 * drilling for a toggle the store already owns.
 */
const PanelToggles = () => {
    const bottomPanel = useCanvasStore((s) => s.bottomPanel);
    const toggleBottomPanel = useCanvasStore((s) => s.toggleBottomPanel);
    return (_jsxs(_Fragment, { children: [_jsx(Tooltip, { label: "Toggle code panel", children: _jsx("button", { className: `${styles.button} ${bottomPanel === 'code' ? styles.active : ''}`, onClick: () => toggleBottomPanel('code'), type: "button", "aria-label": "Toggle code panel", "aria-pressed": bottomPanel === 'code', "data-action": "toggle-code", children: _jsx(IconCode, { size: ICON_SIZE }) }) }), _jsx(Tooltip, { label: "Toggle terminal (Ctrl+`)", children: _jsx("button", { className: `${styles.button} ${bottomPanel === 'terminal' ? styles.active : ''}`, onClick: () => toggleBottomPanel('terminal'), type: "button", "aria-label": "Toggle terminal", "aria-pressed": bottomPanel === 'terminal', "data-action": "toggle-terminal", children: _jsx(IconTerminal2, { size: ICON_SIZE }) }) })] }));
};
