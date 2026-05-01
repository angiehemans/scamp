import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect } from 'react';
import { IconPointer, IconSquare, IconLetterT, IconPhoto, IconForms, IconPalette, IconPlayerPlay, IconSettings, } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './Toolbar.module.css';
const ICON_SIZE = 16;
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
    const projectPath = useCanvasStore((s) => s.projectPath);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const activePageName = useCanvasStore((s) => s.activePage?.name ?? null);
    // Preview is gated on the nextjs project format — legacy projects
    // don't have a `package.json` and can't run `next dev`. The button
    // stays visible (so users discover the feature) but is disabled
    // with a tooltip pointing at the migration banner.
    const canPreview = projectFormat === 'nextjs' &&
        projectPath.length > 0 &&
        activePageName !== null;
    const openPreview = useCallback(() => {
        if (!canPreview || activePageName === null)
            return;
        void window.scamp.openPreview({
            projectPath,
            pageName: activePageName,
        });
    }, [canPreview, projectPath, activePageName]);
    useEffect(() => {
        const handleKey = (e) => {
            const target = e.target;
            if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                return;
            }
            // Cmd/Ctrl+P opens the preview window. Handled before the
            // tool-shortcut block so it isn't blocked by the modifier
            // guard below.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                if (canPreview)
                    openPreview();
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
    }, [setTool, canPreview, openPreview]);
    return (_jsxs("div", { className: styles.toolbar, "data-testid": "element-toolbar", "data-active-tool": activeTool, children: [TOOLS.map((t) => (_jsx(Tooltip, { label: `${t.label} (${t.shortcut})`, children: _jsxs("button", { className: `${styles.button} ${activeTool === t.tool ? styles.active : ''}`, onClick: () => setTool(t.tool), type: "button", "aria-pressed": activeTool === t.tool, "data-tool": t.tool, children: [t.icon, t.label, _jsx("span", { className: styles.shortcut, children: t.shortcut })] }) }, t.tool))), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: canPreview
                    ? 'Open this project in a real browser preview window (⌘P)'
                    : projectFormat === 'legacy'
                        ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
                        : 'Open a page to enable preview.', children: _jsxs("button", { className: styles.button, onClick: openPreview, type: "button", disabled: !canPreview, "data-testid": "preview-button", children: [_jsx(IconPlayerPlay, { size: ICON_SIZE }), "Preview", _jsx("span", { className: styles.shortcut, children: "\u2318P" })] }) }), onOpenTheme && (_jsx(Tooltip, { label: "Theme tokens", children: _jsxs("button", { className: styles.button, onClick: onOpenTheme, type: "button", children: [_jsx(IconPalette, { size: ICON_SIZE }), "Theme"] }) })), onOpenSettings && (_jsx(Tooltip, { label: "Settings", children: _jsxs("button", { className: styles.button, onClick: onOpenSettings, type: "button", children: [_jsx(IconSettings, { size: ICON_SIZE }), "Settings"] }) }))] }));
};
