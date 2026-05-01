import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, } from 'react';
import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';
/**
 * Shared prefix + input + suffix row. Owns local draft state so the
 * caller only sees committed values. On blur, calls `onCommit` then
 * restores the draft to `value`; if the caller updates `value` in
 * response, the effect below syncs the draft forward — so a valid
 * commit reads as "draft moves to new value" and an invalid one reads
 * as "draft reverts".
 */
export const PrefixSuffixInput = ({ value, onCommit, onDraftChange, prefix, suffix, flushPrefix = false, placeholder, inputMode = 'text', title, disabled = false, onArrow, stopKeyPropagation = false, inputRef, inputClassName, spellCheck = false, autoCapitalize, autoCorrect, }) => {
    const [draft, setDraft] = useState(value);
    useEffect(() => {
        setDraft(value);
    }, [value]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
            return;
        }
        if (onArrow && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            onArrow(draft, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
            return;
        }
        if (stopKeyPropagation)
            e.stopPropagation();
    };
    const rowClass = flushPrefix
        ? `${styles.colorInputRow} ${styles.colorInputRowSwatch}`
        : styles.colorInputRow;
    const prefixAttr = typeof prefix === 'string' ? prefix : undefined;
    const row = (_jsxs("div", { className: rowClass, "data-prefix": prefixAttr, children: [prefix !== undefined &&
                (typeof prefix === 'string' ? (_jsx("span", { className: styles.inputPrefix, children: prefix })) : (prefix)), _jsx("input", { ref: inputRef, type: "text", inputMode: inputMode, className: `${styles.colorText} ${inputClassName ?? ''}`, value: draft, placeholder: placeholder, disabled: disabled, spellCheck: spellCheck, autoCapitalize: autoCapitalize, autoCorrect: autoCorrect, onChange: (e) => {
                    setDraft(e.target.value);
                    onDraftChange?.(e.target.value);
                }, onBlur: () => {
                    onCommit(draft.trim());
                    setDraft(value);
                }, onKeyDown: handleKeyDown }), suffix !== undefined &&
                (typeof suffix === 'string' ? (_jsx("span", { className: styles.inputSuffix, children: suffix })) : (suffix))] }));
    return title ? _jsx(Tooltip, { label: title, children: row }) : row;
};
