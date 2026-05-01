import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { TerminalView } from './TerminalView';
import { AppLogView } from './AppLogView';
import { Tooltip } from './controls/Tooltip';
import styles from './TerminalPanel.module.css';
const MAX_SHELLS = 3;
const LOG_TAB = { kind: 'log' };
export const TerminalPanel = ({ cwd, hidden = false }) => {
    const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);
    const [shells, setShells] = useState([{ kind: 'shell', key: 1 }]);
    const [activeTab, setActiveTab] = useState({ kind: 'shell', key: 1 });
    const [nextKey, setNextKey] = useState(2);
    const logEntryCount = useAppLogStore((s) => s.entries.length);
    const handleAddTab = () => {
        if (shells.length >= MAX_SHELLS)
            return;
        const tab = { kind: 'shell', key: nextKey };
        setShells([...shells, tab]);
        setActiveTab(tab);
        setNextKey(nextKey + 1);
    };
    const handleCloseShell = (key) => {
        const remaining = shells.filter((t) => t.key !== key);
        setShells(remaining);
        if (remaining.length === 0) {
            // No shells left — hide the panel and seed a fresh shell so the
            // next time the user opens the terminal there's something ready.
            setBottomPanel('none');
            const seed = { kind: 'shell', key: nextKey };
            setShells([seed]);
            setActiveTab(seed);
            setNextKey(nextKey + 1);
            return;
        }
        if (activeTab.kind === 'shell' && activeTab.key === key) {
            setActiveTab(remaining[0]);
        }
    };
    const handleExit = useCallback(() => {
        // node-pty exit happens when the user types `exit`. We leave the tab in
        // place so they can read the final output; closing it is their choice.
    }, []);
    const isActive = (tab) => {
        if (tab.kind === 'log')
            return activeTab.kind === 'log';
        return activeTab.kind === 'shell' && activeTab.key === tab.key;
    };
    return (_jsxs("div", { className: styles.panel, "data-testid": "terminal-panel", "data-hidden": hidden ? 'true' : 'false', 
        // Hidden mode keeps the DOM tree (and the pty processes inside
        // each TerminalView) alive while occupying zero layout space.
        style: hidden ? { display: 'none' } : undefined, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Terminal" }), _jsxs("div", { className: styles.tabs, children: [_jsxs("div", { className: `${styles.tab} ${isActive(LOG_TAB) ? styles.tabActive : ''}`, onClick: () => setActiveTab(LOG_TAB), children: [_jsx("span", { children: "App Log" }), logEntryCount > 0 && (_jsx("span", { className: styles.badge, children: logEntryCount }))] }, "app-log"), shells.map((tab, idx) => (_jsxs("div", { className: `${styles.tab} ${isActive(tab) ? styles.tabActive : ''}`, onClick: () => setActiveTab(tab), children: [_jsx("span", { children: `Shell ${idx + 1}` }), _jsx(Tooltip, { label: "Close", children: _jsx("button", { className: styles.tabClose, onClick: (e) => {
                                                e.stopPropagation();
                                                handleCloseShell(tab.key);
                                            }, type: "button", children: "\u00D7" }) })] }, tab.key))), shells.length < MAX_SHELLS && (_jsx(Tooltip, { label: "New shell", children: _jsx("button", { className: styles.addTab, onClick: handleAddTab, type: "button", children: "+" }) }))] }), _jsx("span", { className: styles.spacer }), _jsx(Tooltip, { label: "Hide terminal panel", children: _jsx("button", { className: styles.closePanel, onClick: () => setBottomPanel('none'), type: "button", children: "\u00D7" }) })] }), _jsxs("div", { className: styles.body, children: [_jsx("div", { className: styles.tabContent, style: { display: isActive(LOG_TAB) ? 'block' : 'none' }, children: _jsx(AppLogView, {}) }, "app-log-content"), shells.map((tab) => (_jsx("div", { className: styles.tabContent, style: { display: isActive(tab) ? 'block' : 'none' }, children: _jsx(TerminalView, { cwd: cwd, onExit: handleExit }) }, tab.key)))] })] }));
};
