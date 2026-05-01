import { jsx as _jsx } from "react/jsx-runtime";
import styles from './SelectionOverlay.module.css';
const HANDLES = [
    { key: 'nw', className: 'handleNw' },
    { key: 'n', className: 'handleN' },
    { key: 'ne', className: 'handleNe' },
    { key: 'e', className: 'handleE' },
    { key: 'se', className: 'handleSe' },
    { key: 's', className: 'handleS' },
    { key: 'sw', className: 'handleSw' },
    { key: 'w', className: 'handleW' },
];
export const SelectionOverlay = ({ x, y, width, height, showHandles = true, }) => {
    return (_jsx("div", { className: styles.outline, style: { left: x, top: y, width, height }, children: showHandles &&
            HANDLES.map((h) => (_jsx("div", { "data-handle": h.key, className: `${styles.handle} ${styles[h.className]}` }, h.key))) }));
};
