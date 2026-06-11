import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef, } from 'react';
import styles from './Button.module.css';
export const Button = forwardRef(({ variant = 'secondary', size = 'md', disabled = false, onClick, children, type = 'button', autoFocus = false, fullWidth = false, ariaLabel, title, onMouseEnter, onMouseLeave, onFocus, onBlur, }, ref) => {
    const className = [
        styles.button,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
    ]
        .filter(Boolean)
        .join(' ');
    return (_jsx("button", { ref: ref, type: type, className: className, onClick: onClick, disabled: disabled, autoFocus: autoFocus, "aria-label": ariaLabel, title: title, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, onFocus: onFocus, onBlur: onBlur, children: children }));
});
Button.displayName = 'Button';
