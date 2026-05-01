import { jsx as _jsx } from "react/jsx-runtime";
import styles from './Button.module.css';
export const Button = ({ variant = 'secondary', size = 'md', disabled = false, onClick, children, type = 'button', autoFocus = false, fullWidth = false, }) => {
    const className = [
        styles.button,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
    ]
        .filter(Boolean)
        .join(' ');
    return (_jsx("button", { type: type, className: className, onClick: onClick, disabled: disabled, autoFocus: autoFocus, children: children }));
};
