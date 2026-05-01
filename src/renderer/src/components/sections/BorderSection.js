import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { ColorInput } from '../controls/ColorInput';
import { EnumSelect } from '../controls/EnumSelect';
import { FourSideInput } from '../controls/FourSideInput';
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
    if (!element)
        return null;
    return (_jsxs(Section, { title: "Border", elementId: elementId, fields: ['borderColor', 'borderStyle', 'borderWidth', 'borderRadius'], children: [_jsxs(Row, { label: "", children: [_jsx(ColorInput, { value: element.borderColor, onChange: (value) => patchElement(elementId, { borderColor: value }), presetColors: projectColors.length > 0 ? projectColors : undefined, tokens: themeTokens, onOpenTheme: openThemePanel ?? undefined }), _jsx(EnumSelect, { value: element.borderStyle, options: BORDER_STYLE_OPTIONS, onChange: (value) => patchElement(elementId, { borderStyle: value }), title: "Border style" })] }), _jsxs(Row, { label: "", children: [_jsx(FourSideInput, { prefix: "W", title: "Border width (top right bottom left)", value: element.borderWidth, onChange: (next) => patchElement(elementId, { borderWidth: next }), min: 0 }), _jsx(FourSideInput, { prefix: "R", title: "Border radius (top-left top-right bottom-right bottom-left)", value: element.borderRadius, onChange: (next) => patchElement(elementId, { borderRadius: next }), min: 0 })] })] }));
};
