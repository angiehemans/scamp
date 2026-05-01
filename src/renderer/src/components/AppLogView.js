import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { useAppLogStore } from '@store/appLogSlice';
import styles from './AppLogView.module.css';
const formatTime = (ts) => {
    const d = new Date(ts);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
};
const levelClass = (level) => {
    if (level === 'error')
        return styles.levelError;
    if (level === 'warn')
        return styles.levelWarn;
    return styles.levelInfo;
};
/**
 * Read-only pane that surfaces app-level log entries (currently just
 * save failures). Lives as a tab inside `TerminalPanel` alongside the
 * real pty shells — users expect diagnostic output to live in the
 * terminal area.
 */
export const AppLogView = () => {
    const entries = useAppLogStore((s) => s.entries);
    const clear = useAppLogStore((s) => s.clear);
    const scrollRef = useRef(null);
    // Keep the view pinned to the newest entry unless the user scrolls
    // up. We autoscroll on mount and on every new entry.
    useEffect(() => {
        const node = scrollRef.current;
        if (!node)
            return;
        node.scrollTop = node.scrollHeight;
    }, [entries.length]);
    return (_jsxs("div", { className: styles.wrap, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "App events" }), _jsx("span", { className: styles.spacer }), entries.length > 0 && (_jsx("button", { className: styles.clear, onClick: clear, type: "button", children: "Clear" }))] }), _jsx("div", { className: styles.body, ref: scrollRef, children: entries.length === 0 ? (_jsx("div", { className: styles.empty, children: "No events yet." })) : (entries.map((entry) => (_jsxs("div", { className: styles.row, children: [_jsx("span", { className: styles.time, children: formatTime(entry.timestamp) }), _jsx("span", { className: levelClass(entry.level), children: entry.level.toUpperCase() }), _jsx("span", { className: styles.message, children: entry.message })] }, entry.id)))) })] }));
};
