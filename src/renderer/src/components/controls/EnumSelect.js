import { jsx as _jsx } from "react/jsx-runtime";
import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';
export const EnumSelect = ({ value, options, onChange, title, }) => {
    const select = (_jsx("select", { className: styles.select, value: value, onChange: (e) => onChange(e.target.value), children: options.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }));
    return title ? _jsx(Tooltip, { label: title, children: select }) : select;
};
