import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext } from '@store/hooks/useColorPickerContext';
import { useResolvedElement } from '@store/useResolvedElement';
import { ColorInput } from '../controls/ColorInput';
import { NumberInput } from '../controls/NumberInput';
import { previewStyle } from '../controls/livePreview';
import { Section, Row } from './Section';
/**
 * Fill / stroke / stroke-width controls for an inline `<svg>` element.
 * Element-level paint cascades to the svg's shapes (whose own fill/stroke
 * were stripped on import), so editing here recolours the icon without
 * touching `svgSource`. Rendered by UiPanel only when `tag === 'svg'`.
 * see docs/plans/svg-improvements-plan.md
 */
export const SvgSection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const { presetColors, themeTokens, onOpenTheme } = useColorPickerContext();
    if (!element)
        return null;
    return (_jsxs(Section, { title: "SVG", elementId: elementId, fields: ['fill', 'stroke', 'strokeWidth'], cssProperties: ['fill', 'stroke', 'stroke-width'], children: [_jsx(Row, { label: "Fill", children: _jsx(ColorInput, { value: element.fill ?? '', onChange: (value) => patchElement(elementId, { fill: value }), onPreview: previewStyle(elementId, 'fill'), historyElementId: elementId, historyPropertyKey: "fill", presetColors: presetColors, tokens: themeTokens, onOpenTheme: onOpenTheme }) }), _jsxs(Row, { label: "Stroke", children: [_jsx(ColorInput, { value: element.stroke ?? '', onChange: (value) => patchElement(elementId, { stroke: value }), onPreview: previewStyle(elementId, 'stroke'), historyElementId: elementId, historyPropertyKey: "stroke", presetColors: presetColors, tokens: themeTokens, onOpenTheme: onOpenTheme }), _jsx(NumberInput, { prefix: "W", title: "Stroke width (px)", value: element.strokeWidth, onChange: (value) => patchElement(elementId, { strokeWidth: value }), min: 0, allowEmpty: true })] })] }));
};
