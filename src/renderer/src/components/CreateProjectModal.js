import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { suggestProjectName, validateProjectName } from '@shared/projectName';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
import { Button } from './controls/Button';
import styles from './CreateProjectModal.module.css';
/**
 * Modal dialog for creating a new project. Handles name input, validation,
 * auto-suggest on blur, and path hint. The parent owns the actual IPC call
 * and passes it via `onSubmit`.
 */
export const CreateProjectModal = ({ defaultFolder, onSubmit, onCancel, }) => {
    const [draftName, setDraftName] = useState('');
    const [error, setError] = useState(null);
    const [creating, setCreating] = useState(false);
    const inputRef = useRef(null);
    // Focus the input on mount.
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    useDialogBackdrop({ onClose: onCancel, disabled: creating });
    const handleSubmit = async (e) => {
        e.preventDefault();
        const validation = validateProjectName(draftName);
        if (!validation.ok) {
            setError(validation.error);
            return;
        }
        setError(null);
        setCreating(true);
        try {
            await onSubmit(validation.value);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setCreating(false);
        }
    };
    return (_jsx("div", { className: styles.backdrop, onClick: (e) => {
            if (e.target === e.currentTarget && !creating)
                onCancel();
        }, children: _jsxs("form", { className: styles.dialog, onSubmit: handleSubmit, children: [_jsx("h2", { className: styles.title, children: "New Project" }), _jsx("label", { className: styles.label, htmlFor: "modal-project-name", children: "Project name" }), _jsx("input", { ref: inputRef, id: "modal-project-name", className: styles.input, type: "text", value: draftName, onChange: (e) => {
                        setDraftName(e.target.value);
                        setError(null);
                    }, onBlur: (e) => {
                        const suggestion = suggestProjectName(e.target.value);
                        if (suggestion && suggestion !== e.target.value) {
                            setDraftName(suggestion);
                        }
                    }, placeholder: "my-portfolio", disabled: creating }), _jsxs("p", { className: styles.hint, children: ["Will be created at", ' ', _jsxs("code", { className: styles.hintCode, children: [defaultFolder, "/", draftName || '<name>'] })] }), error && _jsx("div", { className: styles.error, children: error }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "secondary", onClick: onCancel, disabled: creating, fullWidth: true, children: "Cancel" }), _jsx(Button, { variant: "primary", type: "submit", disabled: creating, fullWidth: true, children: creating ? 'Creating...' : 'Create Project' })] })] }) }));
};
