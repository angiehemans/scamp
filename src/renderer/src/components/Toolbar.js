import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { IconAi, IconCheck, IconPointer, IconSquare, IconLetterT, IconPhoto, IconForms, } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import { copyContextToClipboard } from '../lib/copyContext';
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
    return (_jsxs("div", { className: styles.toolbar, "data-testid": "element-toolbar", "data-active-tool": activeTool, children: [TOOLS.map((t) => (_jsx(Tooltip, { label: `${t.label} (${t.shortcut})`, children: _jsx("button", { className: `${styles.button} ${activeTool === t.tool ? styles.active : ''}`, onClick: () => setTool(t.tool), type: "button", disabled: isPreviewing, "aria-pressed": activeTool === t.tool, "aria-label": t.label, "data-tool": t.tool, children: t.icon }) }, t.tool))), _jsx("div", { className: styles.spacer }), _jsx(CopyContextButton, {})] }));
};
/** How long the check mark replaces the icon after a successful copy. */
const COPIED_FEEDBACK_MS = 1200;
/**
 * Copies a one-line description of the selection for pasting in front of a
 * terminal question. Deliberately NOT disabled without a selection — the
 * page-level string is useful on its own, and dimming it would hide the
 * feature exactly when someone is asking a whole-page question.
 * see docs/plans/copy-context-button-plan.md
 */
const CopyContextButton = () => {
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);
    useEffect(() => () => {
        if (timer.current !== null)
            clearTimeout(timer.current);
    }, []);
    const handleClick = () => {
        void copyContextToClipboard().then((ok) => {
            // Only claim success when the write actually landed.
            if (!ok)
                return;
            setCopied(true);
            if (timer.current !== null)
                clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        });
    };
    return (_jsx(Tooltip, { label: copied ? 'Copied' : 'Copy context for agent (⇧⌘C)', children: _jsx("button", { className: styles.button, onClick: handleClick, type: "button", "aria-label": "Copy context for agent", "data-copied": copied ? 'true' : undefined, "data-action": "copy-context", children: copied ? (_jsx(IconCheck, { size: ICON_SIZE })) : (_jsx(IconAi, { size: ICON_SIZE })) }) }));
};
