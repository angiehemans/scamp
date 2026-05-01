import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import styles from './PageContextMenu.module.css';
/**
 * Small floating context menu anchored at a viewport (x, y). Closes on
 * outside click, Escape, or after an item is chosen.
 */
export const PageContextMenu = ({ x, y, items, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const handleDown = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                onClose();
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        // Defer attaching to the next microtask so the click that opened the
        // menu doesn't immediately close it.
        const raf = requestAnimationFrame(() => {
            document.addEventListener('mousedown', handleDown);
            document.addEventListener('keydown', handleKey);
        });
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);
    return (_jsx("div", { ref: ref, className: styles.menu, style: { left: x, top: y }, role: "menu", children: items.map((item, i) => (_jsx("button", { type: "button", role: "menuitem", className: `${styles.item} ${item.destructive ? styles.destructive : ''}`, disabled: item.disabled, onClick: () => {
                if (item.disabled)
                    return;
                item.onSelect();
                onClose();
            }, children: item.label }, i))) }));
};
