import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSaveStatusStore } from '@store/saveStatusSlice';
import { retryLastSave } from '../syncBridge';
import styles from './SaveStatusIndicator.module.css';
/**
 * Header indicator showing whether canvas edits are in sync with disk.
 * Driven by `useSaveStatusStore`, which transitions through
 * saved → unsaved → saving → saved on every edit cycle, or lands in
 * `error` when a write fails. The retry button re-issues the last
 * attempted save.
 */
export const SaveStatusIndicator = () => {
    const state = useSaveStatusStore((s) => s.state);
    if (state.kind === 'saved') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.saved}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "saved", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u2713" }), "Saved"] }));
    }
    if (state.kind === 'saving') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.saving}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "saving", children: [_jsx("span", { className: `${styles.glyph} ${styles.spinner}`, "aria-hidden": "true", children: "\u2191" }), "Saving\u2026"] }));
    }
    if (state.kind === 'unsaved') {
        return (_jsxs("span", { className: `${styles.indicator} ${styles.unsaved}`, "aria-live": "polite", "data-testid": "save-status", "data-status": "unsaved", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u25CF" }), "Unsaved"] }));
    }
    return (_jsxs("span", { className: `${styles.indicator} ${styles.error}`, "aria-live": "assertive", "data-testid": "save-status", "data-status": "error", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u26A0" }), _jsx("span", { className: styles.errorMessage, title: state.message, children: "Save failed" }), _jsx("button", { className: styles.retryButton, onClick: () => retryLastSave(), type: "button", children: "Retry" })] }));
};
