import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { IconLink, IconLinkOff } from '@tabler/icons-react';
import { useCanvasStore, selectIsRatioLocked } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { SizeTypeSelect } from '../controls/SizeTypeSelect';
import { parseSizeValue } from '@lib/parsers';
import { combineTypedWithType, rawForType, sizeTypeLabel, sizeTypeOf, } from '@lib/sizeType';
import { lockedSizePatch } from '@lib/aspectRatio';
import { Section, Row } from './Section';
import styles from './SizeSection.module.css';
// "Hug" (fit-content) and "Auto" size to content, which a plain (non
// flex/grid) rectangle can't do — disable those types there.
const CONTENT_DISABLED_TYPES = new Set(['hug', 'auto']);
// Types whose value is a single plain number the arrow keys can step.
// (Keyword modes have no number; `custom` may be a calc()/var() expression.)
const STEPPABLE_TYPES = new Set([
    'px',
    'percent',
    'vh',
    'vw',
]);
/** Leading numeric value of a string (e.g. "50%" → 50), or null. */
const leadingNumber = (s) => {
    const m = s.trim().match(/^-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
};
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
    const toggleRatioLock = useCanvasStore((s) => s.toggleRatioLock);
    const clearRatioLock = useCanvasStore((s) => s.clearRatioLock);
    const ratioLocked = useCanvasStore((s) => selectIsRatioLocked(s, elementId));
    const lockedRatio = useCanvasStore((s) => s.ratioLocks[elementId]);
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
    // "Hug" (fit-content) and "Auto" size an element to its content. A plain
    // rectangle that isn't a flex/grid container has no content mechanism —
    // its absolutely-positioned children don't contribute to an auto size —
    // so those modes collapse it to ~0. Disable them there. Text / input /
    // image / component-instance size to intrinsic or rendered content, and
    // flex/grid rectangles hug their children, so all keep every mode.
    const contentSizingDisabled = element.type === 'rectangle' &&
        element.display !== 'flex' &&
        element.display !== 'grid';
    const disabledTypes = contentSizingDisabled
        ? CONTENT_DISABLED_TYPES
        : undefined;
    // Current type per axis (px / % / Fill / Hug / Auto / …) and the
    // number shown in the field. For a fixed axis the number is the stored
    // value (a raw calc()/var() shows verbatim); a non-fixed axis shows its
    // measured render size.
    const widthType = sizeTypeOf(element.widthMode, element.widthCustom);
    const heightType = sizeTypeOf(element.heightMode, element.heightCustom);
    const widthFieldValue = !isWidthFixed
        ? measured.width !== undefined
            ? String(measured.width)
            : ''
        : widthType === 'custom'
            ? element.widthCustom ?? ''
            : String(element.widthValue);
    const heightFieldValue = !isHeightFixed
        ? measured.height !== undefined
            ? String(measured.height)
            : ''
        : heightType === 'custom'
            ? element.heightCustom ?? ''
            : String(element.heightValue);
    // Seed value used when switching type from the menu.
    const widthNumber = isWidthFixed
        ? element.widthValue
        : measured.width ?? element.widthValue;
    const heightNumber = isHeightFixed
        ? element.heightValue
        : measured.height ?? element.heightValue;
    // Ratio to feed the commit helpers — only when the lock is actually in
    // effect (both axes fixed). `lockedRatio` may be undefined when unlocked.
    const activeRatio = ratioLocked ? lockedRatio ?? null : null;
    // A committed W/H edit that lands a non-fixed mode drops the lock (a
    // stretch/auto axis can't be ratio-locked). When locked+fixed, the
    // paired dimension is recomputed inside `lockedSizePatch`.
    const handleCommitWidth = (raw) => {
        if (parseSizeValue(raw).mode !== 'fixed')
            clearRatioLock(elementId);
        patchElement(elementId, lockedSizePatch(element, 'width', raw, activeRatio));
    };
    const handleCommitHeight = (raw) => {
        if (parseSizeValue(raw).mode !== 'fixed')
            clearRatioLock(elementId);
        patchElement(elementId, lockedSizePatch(element, 'height', raw, activeRatio));
    };
    // Picking a type from the right-side menu converts the current value to
    // that type (seeded with the axis's current number) and commits it.
    const handleSelectWidthType = (type) => handleCommitWidth(rawForType(type, widthNumber));
    const handleSelectHeightType = (type) => handleCommitHeight(rawForType(type, heightNumber));
    // Arrow-key stepping (±1, ±10 with Shift). Steps the field's current
    // number and re-commits with the active unit. Only wired for the
    // plain-number types (see STEPPABLE_TYPES).
    const makeArrowHandler = (type, seed, commit) => (draft, direction, shift) => {
        const step = (shift ? 10 : 1) * direction;
        const base = leadingNumber(draft) ?? seed;
        const next = Math.max(0, base + step);
        commit(combineTypedWithType(String(next), type));
    };
    const handleToggleLock = () => {
        // Pass the measured render size so a non-fixed axis can be snapped to
        // fixed on lock (undefined axes fall back to the stored value).
        toggleRatioLock(elementId, {
            width: measured.width,
            height: measured.height,
        });
    };
    // Ratio-lock toggle, hoisted onto the section's title row (right-aligned).
    const lockButton = (_jsxs("button", { type: "button", className: `${styles.lockButton} ${ratioLocked ? styles.lockButtonActive : ''}`, onClick: handleToggleLock, "aria-pressed": ratioLocked, title: ratioLocked
            ? 'Unlock aspect ratio'
            : 'Lock aspect ratio — width and height scale together', children: [ratioLocked ? _jsx(IconLink, { size: 13 }) : _jsx(IconLinkOff, { size: 13 }), ratioLocked ? 'Ratio locked' : 'Lock ratio'] }));
    return (_jsxs(Section, { title: "Size", titleAccessory: lockButton, elementId: elementId, fields: [
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
                            ? 'Width — type a number, or any CSS length (100vh, calc(...)). Set the unit on the right.'
                            : 'Computed width (border-box). Type a number to make it fixed, or change the type on the right.', value: widthFieldValue, placeholder: isWidthFixed ? undefined : sizeTypeLabel(widthType), onCommit: (raw) => handleCommitWidth(combineTypedWithType(raw, widthType)), ...(STEPPABLE_TYPES.has(widthType)
                            ? { onArrow: makeArrowHandler(widthType, widthNumber, handleCommitWidth) }
                            : {}), computed: !isWidthFixed, suffix: _jsx(SizeTypeSelect, { value: widthType, orientation: "horizontal", onSelect: handleSelectWidthType, ...(disabledTypes ? { disabledTypes } : {}), ariaLabel: "Width type" }) }), _jsx(PrefixSuffixInput, { prefix: "H", title: isHeightFixed
                            ? 'Height — type a number, or any CSS length (100vh, calc(...)). Set the unit on the right.'
                            : 'Computed height (border-box). Type a number to make it fixed, or change the type on the right.', value: heightFieldValue, placeholder: isHeightFixed ? undefined : sizeTypeLabel(heightType), onCommit: (raw) => handleCommitHeight(combineTypedWithType(raw, heightType)), ...(STEPPABLE_TYPES.has(heightType)
                            ? { onArrow: makeArrowHandler(heightType, heightNumber, handleCommitHeight) }
                            : {}), computed: !isHeightFixed, suffix: _jsx(SizeTypeSelect, { value: heightType, orientation: "vertical", onSelect: handleSelectHeightType, ...(disabledTypes ? { disabledTypes } : {}), ariaLabel: "Height type" }) })] }), parentIsGrid && (_jsxs(_Fragment, { children: [_jsx(Row, { label: "", children: _jsx(PrefixSuffixInput, { prefix: "Col", title: "grid-column", value: element.gridColumn, placeholder: "span 2", onCommit: (value) => patchElement(elementId, { gridColumn: value.trim() }) }) }), _jsx(Row, { label: "", children: _jsx(PrefixSuffixInput, { prefix: "Row", title: "grid-row", value: element.gridRow, placeholder: "1 / 3", onCommit: (value) => patchElement(elementId, { gridRow: value.trim() }) }) }), _jsxs(Row, { label: "", children: [_jsx(EnumSelect, { value: element.alignSelf, options: GRID_SELF_OPTIONS, onChange: (value) => patchElement(elementId, { alignSelf: value }), title: "Align self" }), _jsx(EnumSelect, { value: element.justifySelf, options: GRID_SELF_OPTIONS, onChange: (value) => patchElement(elementId, { justifySelf: value }), title: "Justify self" })] })] }))] }));
};
