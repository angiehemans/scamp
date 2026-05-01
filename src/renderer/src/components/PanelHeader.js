import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { classNameFor } from '@lib/generateCode';
import styles from './PropertiesPanel.module.css';
/**
 * The class chip + multi-select badge that sits above the mode toggle.
 * Reads the primary selection straight from the canvas store so the
 * router doesn't have to thread it through props.
 */
export const PanelHeader = () => {
    const element = useCanvasStore((s) => {
        const id = s.selectedElementIds[0];
        return id ? s.elements[id] : undefined;
    });
    const selectionCount = useCanvasStore((s) => s.selectedElementIds.length);
    if (!element)
        return null;
    const className = classNameFor(element);
    return (_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.label, children: "Class" }), _jsxs("code", { className: styles.className, children: [".", className] }), selectionCount > 1 && (_jsxs("span", { className: styles.multiBadge, children: ["+", selectionCount - 1, " more"] }))] }));
};
