import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { suggestComponentName, validateComponentName, } from '@shared/componentName';
import styles from './PageNameInput.module.css';
/**
 * Inline text input for naming a new component. Mirror of
 * `PageNameInput` — focuses on mount, validates per-keystroke,
 * Enter confirms (when valid), Escape cancels, blur cancels.
 *
 * On confirm, the user's input is passed through
 * `suggestComponentName` so casual entries like `hero card` get
 * promoted to `HeroCard`. The post-suggestion result is what gets
 * sent to `createComponent` — main-side validation runs on the
 * same shape, so there's no surprise rejection.
 */
export const ComponentNameInput = ({ initialValue = '', existingNames, onConfirm, onCancel, error: externalError, busy = false, }) => {
    const inputRef = useRef(null);
    const [draft, setDraft] = useState(initialValue);
    const [touched, setTouched] = useState(false);
    useEffect(() => {
        const el = inputRef.current;
        if (!el)
            return;
        el.focus();
        el.select();
    }, []);
    // Show the suggested PascalCase shape as the validation target so
    // the user sees how their input will normalise on confirm.
    const suggested = suggestComponentName(draft);
    const validation = validateComponentName(suggested, existingNames);
    const visibleError = externalError ??
        (touched && !validation.ok ? validation.error : null);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (validation.ok && !busy)
                onConfirm(validation.value);
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };
    return (_jsxs("div", { className: styles.wrap, children: [_jsx("input", { ref: inputRef, type: "text", className: styles.input, value: draft, readOnly: busy, onChange: (e) => {
                    setDraft(e.target.value);
                    setTouched(true);
                }, onKeyDown: handleKeyDown, onBlur: () => {
                    if (!busy)
                        onCancel();
                }, placeholder: "ComponentName", spellCheck: false }), visibleError && _jsx("div", { className: styles.error, children: visibleError })] }));
};
