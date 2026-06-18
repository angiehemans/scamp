import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext, } from '@store/hooks/useColorPickerContext';
import { useListField } from '@store/hooks/useListField';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import { combineShadowColor, splitShadowColor } from '@lib/parsers';
import { Button } from '../controls/Button';
import { ColorInput } from '../controls/ColorInput';
import { NumberInput } from '../controls/NumberInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import { SectionEmptyState } from './SectionEmptyState';
import styles from './ShadowsSection.module.css';
const DEFAULT_NEW_SHADOW = {
    offsetX: 0,
    offsetY: 4,
    blur: 8,
    spread: 0,
    color: 'rgba(0, 0, 0, 0.15)',
    inset: false,
};
const INSET_OPTIONS = [
    { value: 'outset', label: 'Outset' },
    { value: 'inset', label: 'Inset' },
];
export const ShadowsSection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const colorContext = useColorPickerContext();
    const groupToggle = useGroupToggle(elementId, 'shadow', (element?.boxShadows.length ?? 0) > 0);
    const shadowField = useListField(() => element?.boxShadows ?? [], (next) => patchElement(elementId, { boxShadows: next }));
    if (!element)
        return null;
    const shadows = element.boxShadows;
    return (_jsxs(Section, { title: "Shadow", collapsible: true, defaultOpen: shadows.length > 0, elementId: elementId, groupToggle: groupToggle, fields: ['boxShadows'], cssProperties: ['box-shadow'], children: [shadows.length === 0 && _jsx(SectionEmptyState, { testId: "shadows-empty" }), shadows.map((shadow, idx) => (_jsx(ShadowRow, { index: idx, shadow: shadow, elementId: elementId, onChange: (patch) => shadowField.update(idx, patch), onRemove: () => shadowField.remove(idx), colorContext: colorContext }, idx))), _jsx(Row, { label: "", children: _jsx(Button, { variant: "addRow", onClick: () => shadowField.add({ ...DEFAULT_NEW_SHADOW }), children: "+ Add shadow" }) })] }));
};
const ShadowRow = ({ index, shadow, elementId, onChange, onRemove, colorContext, }) => {
    return (_jsxs("div", { className: styles.shadowRow, children: [_jsxs("div", { className: styles.rowHeader, children: [_jsxs("span", { className: styles.rowTitle, children: ["Shadow ", index + 1, shadow.inset && (_jsx(Tooltip, { label: "Inset shadow \u2014 drawn inside the box", children: _jsx("span", { className: styles.insetIcon, "aria-hidden": "true", children: "\u25E7" }) }))] }), _jsx(Tooltip, { label: "Remove shadow", children: _jsx(Button, { variant: "removeRow", onClick: onRemove, ariaLabel: `Remove shadow ${index + 1}`, children: "\u00D7" }) })] }), _jsx(Row, { label: "", children: _jsx(SegmentedControl, { value: shadow.inset ? 'inset' : 'outset', options: INSET_OPTIONS, onChange: (next) => onChange({ inset: next === 'inset' }), title: "Inset shadows are drawn inside the box rather than around it" }) }), _jsxs(Row, { label: "", children: [_jsx(NumberInput, { prefix: "X", title: "X offset", value: shadow.offsetX, onChange: (value) => value !== undefined && onChange({ offsetX: value }) }), _jsx(NumberInput, { prefix: "Y", title: "Y offset", value: shadow.offsetY, onChange: (value) => value !== undefined && onChange({ offsetY: value }) })] }), _jsxs(Row, { label: "", children: [_jsx(NumberInput, { prefix: "B", title: "Blur radius", value: shadow.blur, onChange: (value) => value !== undefined && onChange({ blur: value }), min: 0 }), _jsx(NumberInput, { prefix: "S", title: "Spread radius", value: shadow.spread, onChange: (value) => value !== undefined && onChange({ spread: value }) })] }), _jsx(Row, { label: "", children: _jsx(ShadowColorRow, { color: shadow.color, elementId: elementId, onChange: (color) => onChange({ color }), colorContext: colorContext }) })] }));
};
/**
 * Splits the stored shadow color into a base hex (rendered through
 * ColorInput with `disableAlpha`) and an opacity percentage (rendered
 * as a separate NumberInput). Edits to either control re-combine into
 * an `rgba(...)` string the data layer stores.
 *
 * Token / named-color values can't be combined with a separate alpha
 * (you'd lose the reference), so the opacity input is disabled in
 * that case — the picker still lets the user switch back to a hex.
 */
const ShadowColorRow = ({ color, elementId, onChange, colorContext, }) => {
    const split = splitShadowColor(color);
    const opacityPercent = Math.round(split.alpha * 100);
    const handleColorChange = (next) => {
        const nextSplit = splitShadowColor(next);
        if (!nextSplit.decomposable) {
            // var() / token / named — keep verbatim, can't carry separate
            // opacity here.
            onChange(next);
            return;
        }
        // The picker's `disableAlpha` keeps the SketchPicker's alpha at 1,
        // but the user might still type an `rgba(..., 0.5)` into the text
        // field. When they do, treat that explicit alpha as the new
        // opacity; otherwise carry the existing opacity over so changing
        // the hue doesn't reset the slider.
        const alpha = nextSplit.hasExplicitAlpha ? nextSplit.alpha : split.alpha;
        onChange(combineShadowColor(nextSplit.base, alpha));
    };
    const handleOpacityChange = (percent) => {
        if (percent === undefined)
            return;
        const clamped = Math.max(0, Math.min(100, percent));
        if (!split.decomposable)
            return;
        onChange(combineShadowColor(split.base, clamped / 100));
    };
    return (_jsxs(_Fragment, { children: [_jsx(ColorInput, { value: color, onChange: handleColorChange, historyElementId: elementId, historyPropertyKey: "boxShadows", presetColors: colorContext.presetColors, tokens: colorContext.themeTokens, onOpenTheme: colorContext.onOpenTheme, disableAlpha: true }), _jsx(NumberInput, { prefix: "O", suffix: "%", title: split.decomposable
                    ? 'Shadow opacity (0–100)'
                    : 'Opacity is disabled for token / named-color shadows. Pick a hex color to enable.', value: opacityPercent, onChange: handleOpacityChange, min: 0, max: 100, disabled: !split.decomposable })] }));
};
