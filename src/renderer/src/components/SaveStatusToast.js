import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useSaveStatusStore } from '@store/saveStatusSlice';
import styles from './SaveStatusToast.module.css';
/** How long the toast stays visible before auto-dismissing. */
const AUTO_DISMISS_MS = 4000;
/**
 * Transient one-line notification anchored under the toolbar.
 * Currently used only for aborted writes during external-edit
 * windows — the indicator going to `paused` is too subtle a signal
 * for the moment Scamp drops a canvas edit. The toast is the
 * dedicated "this just happened" surface.
 *
 * Renders nothing when no toast is set. Auto-dismisses via a timer
 * keyed on the toast id (so a stale timer from a previously-shown
 * toast doesn't clear the current one).
 */
export const SaveStatusToast = () => {
    const toast = useSaveStatusStore((s) => s.toast);
    const dismissToast = useSaveStatusStore((s) => s.dismissToast);
    useEffect(() => {
        if (!toast)
            return;
        const id = toast.id;
        const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [toast, dismissToast]);
    if (!toast)
        return null;
    return (_jsxs("div", { className: styles.toast, role: "status", "aria-live": "polite", "data-testid": "save-status-toast", children: [_jsx("span", { className: styles.glyph, "aria-hidden": "true", children: "\u26A0" }), _jsx("span", { className: styles.message, children: toast.message }), _jsx("button", { type: "button", className: styles.dismiss, onClick: () => dismissToast(toast.id), "aria-label": "Dismiss", children: "\u00D7" })] }));
};
