import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { NumberInput } from '../controls/NumberInput';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { Section, Row } from './Section';
const WIDTH_MODE_OPTIONS = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'stretch', label: 'Stretch' },
    { value: 'fit-content', label: 'Hug' },
    { value: 'auto', label: 'Auto' },
];
const HEIGHT_MODE_OPTIONS = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'stretch', label: 'Stretch' },
    { value: 'fit-content', label: 'Hug' },
    { value: 'auto', label: 'Auto' },
];
const GRID_SELF_OPTIONS = [
    { value: 'start', label: 'Start' },
    { value: 'center', label: 'Center' },
    { value: 'end', label: 'End' },
    { value: 'stretch', label: 'Stretch' },
];
/**
 * Measure the actual rendered size of an element on the canvas.
 * Returns undefined if the element isn't mounted or both axes are
 * `fixed` (no computed read-out needed).
 *
 * Uses a `ResizeObserver` rather than polling so the panel reflects
 * layout changes immediately — the user changes a font-size and the
 * computed height in the panel updates in the same frame. The
 * observer is also re-attached when the target element is replaced
 * (e.g. canvas re-renders mounting a fresh DOM node) via a short
 * mutation-tolerant lookup loop on each render.
 *
 * IMPORTANT: scopes the lookup to the canvas frame. The layers panel
 * also tags its rows with `data-element-id`, and a `document.query
 * Selector` would happily return the layers row (which appears
 * earlier in DOM order). The frame is identified by
 * `data-testid="canvas-frame"` (set by `Viewport.tsx`).
 */
const useMeasuredSize = (elementId, widthMode, heightMode) => {
    const [size, setSize] = useState({ width: undefined, height: undefined });
    useEffect(() => {
        // Both axes fixed → no computed read needed; clear and bail.
        if (widthMode === 'fixed' && heightMode === 'fixed') {
            setSize({ width: undefined, height: undefined });
            return;
        }
        const apply = (node) => {
            setSize({
                width: widthMode !== 'fixed' ? Math.round(node.offsetWidth) : undefined,
                height: heightMode !== 'fixed' ? Math.round(node.offsetHeight) : undefined,
            });
        };
        /** Find the rendered element inside the canvas frame — NOT inside
         *  the layers panel, which mirrors the same `data-element-id`. */
        const findCanvasNode = () => {
            const frame = document.querySelector('[data-testid="canvas-frame"]');
            if (!(frame instanceof HTMLElement))
                return null;
            const node = frame.querySelector(`[data-element-id="${elementId}"]`);
            return node instanceof HTMLElement ? node : null;
        };
        let observer = null;
        let mutationObserver = null;
        const attach = () => {
            const node = findCanvasNode();
            if (!node)
                return false;
            apply(node);
            observer = new ResizeObserver(() => apply(node));
            observer.observe(node);
            return true;
        };
        if (!attach()) {
            // Frame or element not yet in the DOM — watch the body for
            // additions and attach as soon as it appears. Disconnect once
            // observed.
            mutationObserver = new MutationObserver(() => {
                if (attach()) {
                    mutationObserver?.disconnect();
                    mutationObserver = null;
                }
            });
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }
        return () => {
            observer?.disconnect();
            mutationObserver?.disconnect();
        };
    }, [elementId, widthMode, heightMode]);
    return size;
};
export const SizeSection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    // Whether THIS element's parent is a grid container — drives the
    // grid-item controls below.
    const parentIsGrid = useCanvasStore((s) => {
        if (!elementId)
            return false;
        const el = s.elements[elementId];
        if (!el?.parentId)
            return false;
        return s.elements[el.parentId]?.display === 'grid';
    });
    if (!element)
        return null;
    const measured = useMeasuredSize(elementId, element.widthMode, element.heightMode);
    const isWidthFixed = element.widthMode === 'fixed';
    const isHeightFixed = element.heightMode === 'fixed';
    return (_jsxs(Section, { title: "Size", elementId: elementId, fields: [
            'widthMode',
            'widthValue',
            'heightMode',
            'heightValue',
            'gridColumn',
            'gridRow',
            'alignSelf',
            'justifySelf',
        ], children: [_jsxs(Row, { label: "", children: [_jsx(NumberInput, { prefix: "W", title: isWidthFixed
                            ? 'Width'
                            : `Computed width (border-box, including padding). Type a number to switch to Fixed.`, value: isWidthFixed ? element.widthValue : measured.width, onChange: (value) => patchElement(elementId, { widthMode: 'fixed', widthValue: value ?? 0 }), min: 0, placeholder: isWidthFixed ? undefined : element.widthMode, computed: !isWidthFixed }), _jsx(EnumSelect, { value: element.widthMode, options: WIDTH_MODE_OPTIONS, onChange: (mode) => patchElement(elementId, { widthMode: mode }), title: "Width mode" })] }), _jsxs(Row, { label: "", children: [_jsx(NumberInput, { prefix: "H", title: isHeightFixed
                            ? 'Height'
                            : `Computed height (border-box, including padding). Type a number to switch to Fixed.`, value: isHeightFixed ? element.heightValue : measured.height, onChange: (value) => patchElement(elementId, { heightMode: 'fixed', heightValue: value ?? 0 }), min: 0, placeholder: isHeightFixed ? undefined : element.heightMode, computed: !isHeightFixed }), _jsx(EnumSelect, { value: element.heightMode, options: HEIGHT_MODE_OPTIONS, onChange: (mode) => patchElement(elementId, { heightMode: mode }), title: "Height mode" })] }), parentIsGrid && (_jsxs(_Fragment, { children: [_jsx(Row, { label: "", children: _jsx(PrefixSuffixInput, { prefix: "Col", title: "grid-column", value: element.gridColumn, placeholder: "span 2", onCommit: (value) => patchElement(elementId, { gridColumn: value.trim() }) }) }), _jsx(Row, { label: "", children: _jsx(PrefixSuffixInput, { prefix: "Row", title: "grid-row", value: element.gridRow, placeholder: "1 / 3", onCommit: (value) => patchElement(elementId, { gridRow: value.trim() }) }) }), _jsxs(Row, { label: "", children: [_jsx(EnumSelect, { value: element.alignSelf, options: GRID_SELF_OPTIONS, onChange: (value) => patchElement(elementId, { alignSelf: value }), title: "Align self" }), _jsx(EnumSelect, { value: element.justifySelf, options: GRID_SELF_OPTIONS, onChange: (value) => patchElement(elementId, { justifySelf: value }), title: "Justify self" })] })] }))] }));
};
