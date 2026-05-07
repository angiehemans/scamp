import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { formatSizeValue, parseSizeValue } from '@lib/parsers';
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
/**
 * Compute the `patchElement` patch for the W input. Runs the typed
 * input through `parseSizeValue` so the user can write any CSS
 * length:
 *   - `100`, `100px` → fixed-px
 *   - `100%` → stretch
 *   - `auto`, `fit-content` → matching keyword mode
 *   - `100vh`, `2em`, `calc(...)`, `var(--w)` → fixed with the
 *     verbatim string preserved in `widthCustom`
 *
 * For non-fixed modes, leave `widthValue` alone (preserves the
 * user's last fixed-px value so toggling back via the dropdown
 * brings it back). Always clear `widthCustom` for non-fixed modes
 * and for plain px input so stale verbatim strings don't linger.
 */
const sizePatchForWidth = (element, raw) => {
    const parsed = parseSizeValue(raw);
    if (parsed.mode === 'fixed') {
        return {
            widthMode: 'fixed',
            widthValue: parsed.value,
            widthCustom: parsed.custom,
        };
    }
    return {
        widthMode: parsed.mode,
        widthValue: element.widthValue,
        widthCustom: undefined,
    };
};
/** Same shape as `sizePatchForWidth`, but for the H input. */
const sizePatchForHeight = (element, raw) => {
    const parsed = parseSizeValue(raw);
    if (parsed.mode === 'fixed') {
        return {
            heightMode: 'fixed',
            heightValue: parsed.value,
            heightCustom: parsed.custom,
        };
    }
    return {
        heightMode: parsed.mode,
        heightValue: element.heightValue,
        heightCustom: undefined,
    };
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
            'widthCustom',
            'heightMode',
            'heightValue',
            'heightCustom',
            'gridColumn',
            'gridRow',
            'alignSelf',
            'justifySelf',
        ], cssProperties: [
            'width',
            'height',
            'min-height',
            'grid-column',
            'grid-row',
            'align-self',
            'justify-self',
        ], children: [_jsxs(Row, { label: "", children: [_jsx(PrefixSuffixInput, { prefix: "W", title: isWidthFixed
                            ? 'Width — type any CSS length (100, 100px, 100vh, 100%, calc(...), auto, fit-content)'
                            : 'Computed width (border-box, including padding). Type any CSS length to override.', value: isWidthFixed
                            ? formatSizeValue(element.widthMode, element.widthValue, element.widthCustom)
                            : measured.width !== undefined
                                ? `${measured.width}px`
                                : '', placeholder: isWidthFixed ? undefined : element.widthMode, onCommit: (raw) => patchElement(elementId, sizePatchForWidth(element, raw)), computed: !isWidthFixed }), _jsx(EnumSelect, { value: element.widthMode, options: WIDTH_MODE_OPTIONS, onChange: (mode) => patchElement(elementId, mode === 'fixed'
                            ? { widthMode: 'fixed', widthCustom: undefined }
                            : { widthMode: mode, widthCustom: undefined }), title: "Width mode" })] }), _jsxs(Row, { label: "", children: [_jsx(PrefixSuffixInput, { prefix: "H", title: isHeightFixed
                            ? 'Height — type any CSS length (100, 100px, 100vh, 100%, calc(...), auto, fit-content)'
                            : 'Computed height (border-box, including padding). Type any CSS length to override.', value: isHeightFixed
                            ? formatSizeValue(element.heightMode, element.heightValue, element.heightCustom)
                            : measured.height !== undefined
                                ? `${measured.height}px`
                                : '', placeholder: isHeightFixed ? undefined : element.heightMode, onCommit: (raw) => patchElement(elementId, sizePatchForHeight(element, raw)), computed: !isHeightFixed }), _jsx(EnumSelect, { value: element.heightMode, options: HEIGHT_MODE_OPTIONS, onChange: (mode) => patchElement(elementId, mode === 'fixed'
                            ? { heightMode: 'fixed', heightCustom: undefined }
                            : { heightMode: mode, heightCustom: undefined }), title: "Height mode" })] }), parentIsGrid && (_jsxs(_Fragment, { children: [_jsx(Row, { label: "", children: _jsx(PrefixSuffixInput, { prefix: "Col", title: "grid-column", value: element.gridColumn, placeholder: "span 2", onCommit: (value) => patchElement(elementId, { gridColumn: value.trim() }) }) }), _jsx(Row, { label: "", children: _jsx(PrefixSuffixInput, { prefix: "Row", title: "grid-row", value: element.gridRow, placeholder: "1 / 3", onCommit: (value) => patchElement(elementId, { gridRow: value.trim() }) }) }), _jsxs(Row, { label: "", children: [_jsx(EnumSelect, { value: element.alignSelf, options: GRID_SELF_OPTIONS, onChange: (value) => patchElement(elementId, { alignSelf: value }), title: "Align self" }), _jsx(EnumSelect, { value: element.justifySelf, options: GRID_SELF_OPTIONS, onChange: (value) => patchElement(elementId, { justifySelf: value }), title: "Justify self" })] })] }))] }));
};
