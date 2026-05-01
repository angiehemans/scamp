import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { NumberInput } from '../controls/NumberInput';
import { Section, Row } from './Section';
export const PositionSection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    if (!element)
        return null;
    return (_jsx(Section, { title: "Position", elementId: elementId, fields: ['x', 'y'], children: _jsxs(Row, { label: "", children: [_jsx(NumberInput, { prefix: "X", title: "X position", value: element.x, onChange: (value) => patchElement(elementId, { x: value ?? 0 }) }), _jsx(NumberInput, { prefix: "Y", title: "Y position", value: element.y, onChange: (value) => patchElement(elementId, { y: value ?? 0 }) })] }) }));
};
