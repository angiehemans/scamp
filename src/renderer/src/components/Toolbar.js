import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { IconPointer, IconSquare, IconLetterT, IconPhoto, IconForms, IconPalette, IconSettings, } from '@tabler/icons-react';
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
export const Toolbar = ({ onOpenSettings, onOpenTheme }) => {
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
    return (_jsxs("div", { className: styles.toolbar, "data-testid": "element-toolbar", "data-active-tool": activeTool, children: [TOOLS.map((t) => (_jsx(Tooltip, { label: `${t.label} (${t.shortcut})`, children: _jsx("button", { className: `${styles.button} ${activeTool === t.tool ? styles.active : ''}`, onClick: () => setTool(t.tool), type: "button", disabled: isPreviewing, "aria-pressed": activeTool === t.tool, "aria-label": t.label, "data-tool": t.tool, children: t.icon }) }, t.tool))), _jsx("span", { className: styles.spacer }), onOpenTheme && (_jsx(Tooltip, { label: "Theme tokens", children: _jsx("button", { className: styles.button, onClick: onOpenTheme, type: "button", "aria-label": "Theme tokens", children: _jsx(IconPalette, { size: ICON_SIZE }) }) })), onOpenSettings && (_jsx(Tooltip, { label: "Settings", children: _jsx("button", { className: styles.button, onClick: onOpenSettings, type: "button", "aria-label": "Settings", children: _jsx(IconSettings, { size: ICON_SIZE }) }) }))] }));
};
