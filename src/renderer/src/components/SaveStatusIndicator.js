import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSaveStatusStore } from '@store/saveStatusSlice';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { formatHistoryLabel } from '@store/formatHistoryLabel';
import { discardDivergedCanvas, resumeFromPause, retryLastSave, saveDivergedCanvas, } from '../syncBridge';
import styles from './SaveStatusIndicator.module.css';
/** Cap on how many recent edits the diverged popover lists. Above
 *  this the popover would scroll; better to show "+ N more." */
const MAX_DIFF_ENTRIES = 5;
/**
 * Header indicator showing whether canvas edits are in sync with disk.
 * Driven by `useSaveStatusStore`. Six states:
 *
 *   - saved        — canvas == disk.
 *   - unsaved      — canvas has uncommitted edits, debounce pending.
 *   - saving       — write IPC in flight.
 *   - error        — write failed (generic IPC failure); retryable.
 *   - paused       — sync engine intentionally suspended writes
 *                    because an external editor is touching project
 *                    files. Canvas edits queue in memory. Click to
 *                    expand for a `Resume now` override.
 *   - diverged     — pause cleared; canvas + disk don't match;
 *                    user picks Save canvas or Discard canvas.
 *   - reloaded-from-disk
 *                  — last write hit a conflict and Scamp adopted
 *                    disk; user's in-flight edit was discarded. NOT
 *                    retryable.
 *
 * `paused`, `diverged`, and `reloaded-from-disk` are clickable to
 * open the popover. The popover's action buttons are wired in
 * Phase 3 (Resume) and Phase 5 (Save / Discard).
 */
export const SaveStatusIndicator = () => {
    const state = useSaveStatusStore((s) => s.state);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const wrapRef = useRef(null);
    // Close the popover when state transitions to a non-interactive
    // value (e.g. saved). Saves the user from a stale popover hanging
    // around after the underlying condition cleared.
    useEffect(() => {
        if (!isInteractive(state))
            setPopoverOpen(false);
    }, [state]);
    // Dismiss the popover on a click anywhere outside its host span.
    useEffect(() => {
        if (!popoverOpen)
            return;
        const handler = (e) => {
            if (wrapRef.current &&
                e.target instanceof Node &&
                !wrapRef.current.contains(e.target)) {
                setPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [popoverOpen]);
    const interactive = isInteractive(state);
    return (_jsxs("span", { ref: wrapRef, className: styles.wrap, children: [renderPill(state, interactive, () => setPopoverOpen((v) => !v)), popoverOpen && interactive && (_jsx("span", { className: styles.popover, role: "dialog", children: renderPopover(state) }))] }));
};
const isInteractive = (state) => state.kind === 'paused' ||
    state.kind === 'diverged' ||
    state.kind === 'reloaded-from-disk';
const renderPill = (state, interactive, onClick) => {
    if (state.kind === 'saved') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.saved}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "saved", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u2713" }), "Saved"] }));
    }
    if (state.kind === 'saving') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.saving}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "saving", children: [_jsx("span", { className: `${styles.glyph} ${styles.spinner}`, "aria-hidden": "true", children: "\u2191" }), "Saving\u2026"] }));
    }
    if (state.kind === 'unsaved') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.unsaved}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "unsaved", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u25CF" }), "Unsaved"] }));
    }
    if (state.kind === 'error') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.error}`, "aria-live": "assertive", "data-testid": "save-status", "data-status": "error", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u26A0" }), _jsx("span", { className: styles.errorMessage, title: state.message, children: "Save failed" }), _jsx("button", { className: styles.retryButton, onClick: () => retryLastSave(), type: "button", children: "Retry" })] }));
    }
    if (state.kind === 'paused') {
        return (_jsxs("button", { type: "button", className: `${styles.indicator} ${styles.paused} ${styles.button}`, "aria-live": "polite", "aria-expanded": interactive ? 'false' : undefined, "data-testid": "save-status", "data-status": "paused", onClick: onClick, children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u23F8" }), "Paused"] }));
    }
    if (state.kind === 'diverged') {
        return (_jsxs("button", { type: "button", className: `${styles.indicator} ${styles.diverged} ${styles.button}`, "aria-live": "assertive", "data-testid": "save-status", "data-status": "diverged", onClick: onClick, children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u26A0" }), "Diverged"] }));
    }
    // reloaded-from-disk
    return (_jsxs("button", { type: "button", className: `${styles.indicator} ${styles.reloaded} ${styles.button}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "reloaded-from-disk", onClick: onClick, children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u21BA" }), "Reloaded"] }));
};
/**
 * Diverged-state popover. Splits out into its own component because
 * it needs `useHistoryStore` / `useCanvasStore` subscriptions — the
 * other popover branches are stateless. Lists the canvas edits that
 * happened DURING the pause so the user can decide between Save
 * canvas and Discard canvas with a clear picture of what's at stake.
 */
const DivergedPopoverBody = () => {
    const pauseStartedAt = useSaveStatusStore((s) => s.pauseStartedAt);
    const activePageId = useHistoryStore((s) => s.activePageId);
    const pageHistory = useHistoryStore((s) => activePageId ? s.perPage[activePageId] : undefined);
    const elements = useCanvasStore((s) => s.elements);
    const recentEntries = useMemo(() => {
        if (!pageHistory)
            return [];
        const since = pauseStartedAt ?? 0;
        // Filter to entries created during the pause, then take the
        // most recent N (the rest fold into the "+ N more" footer).
        return pageHistory.entries.filter((e) => e.timestamp >= since);
    }, [pageHistory, pauseStartedAt]);
    const visible = recentEntries.slice(-MAX_DIFF_ENTRIES).reverse();
    const overflow = Math.max(0, recentEntries.length - visible.length);
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: styles.popoverBody, children: "Your canvas changes haven't been saved because the file was edited externally. Choose which version to keep." }), visible.length > 0 && (_jsxs("div", { className: styles.divergedDiff, children: [_jsx("div", { className: styles.divergedDiffHeader, children: "Canvas changes since the pause:" }), _jsxs("ul", { className: styles.divergedDiffList, children: [visible.map((entry) => (_jsx("li", { children: formatHistoryLabel(entry, elements) }, entry.id))), overflow > 0 && (_jsxs("li", { className: styles.divergedDiffOverflow, children: ["+ ", overflow, " more"] }))] })] })), _jsxs("div", { className: styles.popoverActions, children: [_jsx("button", { type: "button", className: styles.popoverButton, onClick: () => saveDivergedCanvas(), children: "Save canvas" }), _jsx("button", { type: "button", className: styles.popoverButton, onClick: () => discardDivergedCanvas(), children: "Discard canvas" })] })] }));
};
const renderPopover = (state) => {
    if (state.kind === 'paused') {
        return (_jsxs(_Fragment, { children: [_jsx("p", { className: styles.popoverBody, children: state.reason === 'agent-terminal'
                        ? 'Sync paused — an agent is running in the terminal. Canvas edits will queue until it stops writing.'
                        : 'Sync paused — an external editor is writing to project files. Canvas edits will queue until activity settles.' }), _jsx("div", { className: styles.popoverActions, children: _jsx("button", { type: "button", className: styles.popoverButton, onClick: () => resumeFromPause(), children: "Resume now" }) })] }));
    }
    if (state.kind === 'diverged') {
        return _jsx(DivergedPopoverBody, {});
    }
    if (state.kind === 'reloaded-from-disk') {
        return (_jsxs("p", { className: styles.popoverBody, children: [_jsx("code", { children: state.file }), " was edited externally while Scamp was saving. The canvas was reloaded from disk; any in-flight edit was dropped."] }));
    }
    return null;
};
