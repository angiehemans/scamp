import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import { ColorInput } from '../controls/ColorInput';
import { previewStyle } from '../controls/livePreview';
import { EnumSelect } from '../controls/EnumSelect';
import { FourSideInput } from '../controls/FourSideInput';
import { isZeroSpaceTuple } from '@lib/spaceValue';
import { Section, Row } from './Section';
const BORDER_STYLE_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' },
];
export const BorderSection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const projectColors = useCanvasStore(selectProjectColors);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const openThemePanel = useCanvasStore((s) => s.openThemePanel);
    const groupToggle = useGroupToggle(elementId, 'border');
    if (!element)
        return null;
    // Hide the eye when no border is set AND no rounded corners.
    // Border radius lives in the same group, so a rounded-but-
    // un-bordered element still has something to toggle. Token-form
    // sides (e.g. `var(--space-md)`) always count as "set" — they're
    // an authored value the user wants visible in the file.
    const hasBorderContent = element.borderStyle !== 'none' ||
        !isZeroSpaceTuple(element.borderWidth) ||
        !isZeroSpaceTuple(element.borderRadius);
    const effectiveGroupToggle = hasBorderContent || !groupToggle.isOn ? groupToggle : undefined;
    return (_jsxs(Section, { title: "Border", elementId: elementId, groupToggle: effectiveGroupToggle, fields: ['borderColor', 'borderStyle', 'borderWidth', 'borderRadius'], cssProperties: [
            'border',
            'border-width',
            'border-style',
            'border-color',
            'border-radius',
        ], children: [_jsxs(Row, { label: "", children: [_jsx(ColorInput, { value: element.borderColor, onChange: (value) => patchElement(elementId, { borderColor: value }), onPreview: previewStyle(elementId, 'borderColor'), historyElementId: elementId, historyPropertyKey: "borderColor", presetColors: projectColors.length > 0 ? projectColors : undefined, tokens: themeTokens, onOpenTheme: openThemePanel ?? undefined }), _jsx(EnumSelect, { value: element.borderStyle, options: BORDER_STYLE_OPTIONS, onChange: (value) => patchElement(elementId, { borderStyle: value }), title: "Border style" })] }), _jsxs(Row, { label: "", children: [_jsx(FourSideInput, { prefix: "W", title: "Border width (top right bottom left)", value: element.borderWidth, onChange: (next) => patchElement(elementId, { borderWidth: next }), min: 0 }), _jsx(FourSideInput, { prefix: "R", title: "Border radius (top-left top-right bottom-right bottom-left)", value: element.borderRadius, onChange: (next) => patchElement(elementId, { borderRadius: next }), min: 0 })] })] }));
};
