import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { FourSideInput } from '../controls/FourSideInput';
import { Section, Row } from './Section';
export const SpacingSection = ({ elementId, hideMargin = false }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    if (!element)
        return null;
    return (_jsxs(Section, { title: "Spacing", elementId: elementId, fields: hideMargin ? ['padding'] : ['padding', 'margin'], children: [_jsx(Row, { label: "", children: _jsx(FourSideInput, { prefix: "P", title: "Padding (top right bottom left)", value: element.padding, onChange: (next) => patchElement(elementId, { padding: next }), min: 0 }) }), !hideMargin && (_jsx(Row, { label: "", children: _jsx(FourSideInput, { prefix: "M", title: "Margin (top right bottom left)", value: element.margin, onChange: (next) => patchElement(elementId, { margin: next }) }) }))] }));
};
