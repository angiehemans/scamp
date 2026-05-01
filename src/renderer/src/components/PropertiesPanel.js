import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { PanelHeader } from './PanelHeader';
import { PanelModeToggle } from './PanelModeToggle';
import { StateSwitcher } from './StateSwitcher';
import { UiPanel } from './UiPanel';
import { CssPanel } from './CssPanel';
import styles from './PropertiesPanel.module.css';
const SHORTCUTS = [
    { keys: 'V', description: 'Select tool' },
    { keys: 'R', description: 'Rectangle tool' },
    { keys: 'T', description: 'Text tool' },
    { keys: 'I', description: 'Image tool' },
    { keys: 'Delete', description: 'Delete element' },
    { keys: 'Cmd+C', description: 'Copy element' },
    { keys: 'Cmd+V', description: 'Paste element' },
    { keys: 'Cmd+D', description: 'Duplicate element' },
    { keys: 'Cmd+G', description: 'Group selection' },
    { keys: 'Cmd+Z', description: 'Undo' },
    { keys: 'Cmd+Shift+Z', description: 'Redo' },
    { keys: 'Cmd+S', description: 'Save CSS edits' },
    { keys: 'Cmd+=', description: 'Zoom in' },
    { keys: 'Cmd+-', description: 'Zoom out' },
    { keys: 'Cmd+0', description: 'Reset zoom' },
    { keys: 'Double-click', description: 'Edit text / Rename layer' },
    { keys: 'Shift+click', description: 'Multi-select' },
];
const ShortcutsTable = () => (_jsxs("div", { className: styles.shortcutsWrap, children: [_jsx("h3", { className: styles.shortcutsTitle, children: "Keyboard Shortcuts" }), _jsx("table", { className: styles.shortcutsTable, children: _jsx("tbody", { children: SHORTCUTS.map((s) => (_jsxs("tr", { children: [_jsx("td", { className: styles.shortcutKeys, children: s.keys }), _jsx("td", { className: styles.shortcutDesc, children: s.description })] }, s.keys))) }) })] }));
export const PropertiesPanel = () => {
    const selectedId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
    const panelMode = useCanvasStore((s) => s.panelMode);
    if (!selectedId) {
        return (_jsx("aside", { className: styles.panel, "data-testid": "properties-panel", "data-panel-mode": "empty", children: _jsx(ShortcutsTable, {}) }));
    }
    return (_jsxs("aside", { className: styles.panel, "data-testid": "properties-panel", "data-panel-mode": panelMode, children: [_jsx(PanelHeader, {}), _jsx(PanelModeToggle, {}), panelMode === 'ui' && _jsx(StateSwitcher, {}), panelMode === 'ui' ? _jsx(UiPanel, {}) : _jsx(CssPanel, {})] }));
};
