import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconLink, IconLinkOff } from '@tabler/icons-react';
import styles from './SelectionOverlay.module.css';
const CORNER_HANDLES = [
    { key: 'nw', className: 'handleNw' },
    { key: 'ne', className: 'handleNe' },
    { key: 'se', className: 'handleSe' },
    { key: 'sw', className: 'handleSw' },
];
const EDGE_HANDLES = [
    { key: 'n', className: 'handleN' },
    { key: 'e', className: 'handleE' },
    { key: 's', className: 'handleS' },
    { key: 'w', className: 'handleW' },
];
export const SelectionOverlay = ({ x, y, width, height, showHandles = true, ratioLocked = false, onToggleLock, drawOutline = false, }) => {
    // Corner handles always; edge handles only when the ratio isn't locked
    // (a locked ratio scales proportionally, which only corner drags do).
    const handles = ratioLocked
        ? CORNER_HANDLES
        : [...CORNER_HANDLES, ...EDGE_HANDLES];
    // Stop the badge's pointerdown from reaching the interaction layer,
    // which would otherwise start a marquee / clear the selection.
    const handleBadgePointerDown = (e) => {
        e.stopPropagation();
    };
    return (_jsxs("div", { "data-testid": "selection-overlay", className: `${styles.outline} ${drawOutline ? styles.outlineBox : ''}`.trim(), style: { left: x, top: y, width, height }, children: [showHandles &&
                handles.map((h) => (_jsx("div", { "data-handle": h.key, className: `${styles.handle} ${styles[h.className]}` }, h.key))), showHandles && onToggleLock && (_jsx("button", { type: "button", className: `${styles.lockBadge} ${ratioLocked ? styles.lockBadgeActive : ''}`, onPointerDown: handleBadgePointerDown, onClick: onToggleLock, "aria-pressed": ratioLocked, title: ratioLocked
                    ? 'Unlock aspect ratio'
                    : 'Lock aspect ratio — width and height scale together', children: ratioLocked ? _jsx(IconLink, { size: 12 }) : _jsx(IconLinkOff, { size: 12 }) }))] }));
};
