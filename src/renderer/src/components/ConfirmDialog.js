import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
import { Button } from './controls/Button';
import styles from './ConfirmDialog.module.css';
/**
 * A small modal for confirming destructive or irreversible actions.
 * Intentionally generic so it can be reused for deletes, overwrites,
 * and anywhere else we need a yes/no prompt.
 */
export const ConfirmDialog = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'primary', onConfirm, onCancel, }) => {
    useDialogBackdrop({ onClose: onCancel });
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onConfirm]);
    return (_jsx("div", { className: styles.backdrop, onClick: onCancel, children: _jsxs("div", { className: styles.dialog, role: "dialog", "aria-modal": "true", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: styles.title, children: title }), _jsx("p", { className: styles.message, children: message }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "ghost", onClick: onCancel, children: cancelLabel }), _jsx(Button, { variant: variant === 'destructive' ? 'destructive' : 'primary', onClick: onConfirm, autoFocus: true, children: confirmLabel })] })] }) }));
};
