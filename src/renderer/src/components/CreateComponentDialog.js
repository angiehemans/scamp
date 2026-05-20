import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
import { ComponentNameInput } from './ComponentNameInput';
import styles from './ConfirmDialog.module.css';
/**
 * Modal prompting for a PascalCase component name. Used by the
 * canvas "Create component…" right-click action — the user picks
 * an element, this dialog asks for a name, and the convert-to-
 * component flow runs on confirm.
 *
 * Reuses `ConfirmDialog`'s backdrop CSS so the visual treatment
 * matches the rest of Scamp's modal surfaces. Enter on the input
 * submits; Escape / outside-click cancels.
 */
export const CreateComponentDialog = ({ existingNames, error, busy, onConfirm, onCancel, }) => {
    useDialogBackdrop({ onClose: onCancel });
    // Keep the dialog's surface from swallowing Enter / Escape inside
    // the underlying input (`ComponentNameInput` handles them itself).
    useEffect(() => {
        // No-op: backdrop handles Escape; Enter is owned by the input.
    }, []);
    return (_jsx("div", { className: styles.backdrop, onClick: onCancel, children: _jsxs("div", { className: styles.dialog, role: "dialog", "aria-modal": "true", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: styles.title, children: "Create component" }), _jsxs("p", { className: styles.message, children: ["Pick a PascalCase name. Scamp will write", _jsx("code", { children: " components/<Name>/<Name>.tsx" }), " and replace the selected element with an instance."] }), _jsx(ComponentNameInput, { existingNames: existingNames, onConfirm: onConfirm, onCancel: onCancel, error: error, busy: busy })] }) }));
};
