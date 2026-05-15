import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { IconAlignLeft, IconAlignCenter, IconAlignRight } from '@tabler/icons-react';
import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import { useFontsStore, selectAllFonts } from '@store/fontsSlice';
import { classifyToken } from '@lib/tokenClassify';
import { ColorInput } from '../controls/ColorInput';
import { previewStyle } from '../controls/livePreview';
import { EnumSelect } from '../controls/EnumSelect';
import { FontPicker } from '../controls/FontPicker';
import { SegmentedControl } from '../controls/SegmentedControl';
import { TokenOrNumberInput } from '../controls/TokenOrNumberInput';
import { Section, Row } from './Section';
const FONT_WEIGHT_OPTIONS = [
    { value: '400', label: '400' },
    { value: '500', label: '500' },
    { value: '600', label: '600' },
    { value: '700', label: '700' },
];
const ICON_SIZE = 14;
const TEXT_ALIGN_OPTIONS = [
    { value: 'left', label: _jsx(IconAlignLeft, { size: ICON_SIZE }) },
    { value: 'center', label: _jsx(IconAlignCenter, { size: ICON_SIZE }) },
    { value: 'right', label: _jsx(IconAlignRight, { size: ICON_SIZE }) },
];
const isFontWeight = (n) => n === 400 || n === 500 || n === 600 || n === 700;
export const TypographySection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const projectColors = useCanvasStore(selectProjectColors);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const openThemePanel = useCanvasStore((s) => s.openThemePanel);
    const allFonts = useFontsStore(selectAllFonts);
    // Filter theme tokens by category so each input only offers tokens
    // that make sense for that property.
    const fontSizeTokens = useMemo(() => themeTokens.filter((t) => classifyToken(t.value) === 'fontSize'), [themeTokens]);
    const lineHeightTokens = useMemo(() => themeTokens.filter((t) => classifyToken(t.value) === 'lineHeight'), [themeTokens]);
    const fontFamilyTokens = useMemo(() => themeTokens.filter((t) => classifyToken(t.value) === 'fontFamily'), [themeTokens]);
    const letterSpacingTokens = fontSizeTokens; // lengths work for both
    const groupToggle = useGroupToggle(elementId, 'typography');
    if (!element || element.type !== 'text')
        return null;
    // Hide the eye when none of the typed typography fields are set
    // (and the group isn't already off — leave it visible so the
    // user can toggle back on).
    const hasTypographyContent = element.fontFamily !== undefined ||
        element.fontSize !== undefined ||
        element.fontWeight !== undefined ||
        element.color !== undefined ||
        element.textAlign !== undefined ||
        element.lineHeight !== undefined ||
        element.letterSpacing !== undefined;
    const effectiveGroupToggle = hasTypographyContent || !groupToggle.isOn ? groupToggle : undefined;
    return (_jsxs(Section, { title: "Typography", elementId: elementId, groupToggle: effectiveGroupToggle, fields: [
            'fontFamily',
            'fontSize',
            'fontWeight',
            'color',
            'textAlign',
            'lineHeight',
            'letterSpacing',
        ], cssProperties: [
            'font-family',
            'font-size',
            'font-weight',
            'color',
            'text-align',
            'line-height',
            'letter-spacing',
        ], children: [_jsx(Row, { label: "", children: _jsx(FontPicker, { value: element.fontFamily ?? '', fonts: allFonts, fontTokens: fontFamilyTokens, onChange: (value) => patchElement(elementId, {
                        fontFamily: value.length > 0 ? value : undefined,
                    }), title: "Font family" }) }), _jsxs(Row, { label: "", children: [_jsx(TokenOrNumberInput, { prefix: "Sz", title: "Font size", value: element.fontSize, tokens: fontSizeTokens, defaultUnit: "px", onChange: (value) => patchElement(elementId, { fontSize: value }), onOpenTheme: openThemePanel ?? undefined, placeholder: "auto" }), _jsx(EnumSelect, { value: String(element.fontWeight ?? 400), options: FONT_WEIGHT_OPTIONS, onChange: (value) => {
                            const n = Number(value);
                            if (isFontWeight(n))
                                patchElement(elementId, { fontWeight: n });
                        }, title: "Font weight" })] }), _jsxs(Row, { label: "", children: [_jsx(ColorInput, { value: element.color ?? '#000000', onChange: (value) => patchElement(elementId, { color: value }), onPreview: previewStyle(elementId, 'color'), historyElementId: elementId, historyPropertyKey: "color", presetColors: projectColors.length > 0 ? projectColors : undefined, tokens: themeTokens, onOpenTheme: openThemePanel ?? undefined }), _jsx(SegmentedControl, { value: element.textAlign ?? 'left', options: TEXT_ALIGN_OPTIONS, onChange: (value) => patchElement(elementId, { textAlign: value }), title: "Text align" })] }), _jsxs(Row, { label: "", children: [_jsx(TokenOrNumberInput, { prefix: "LH", title: "Line height", value: element.lineHeight, tokens: lineHeightTokens, defaultUnit: "", onChange: (value) => patchElement(elementId, { lineHeight: value }), onOpenTheme: openThemePanel ?? undefined, placeholder: "auto" }), _jsx(TokenOrNumberInput, { prefix: "LS", title: "Letter spacing", value: element.letterSpacing, tokens: letterSpacingTokens, defaultUnit: "px", onChange: (value) => patchElement(elementId, { letterSpacing: value }), onOpenTheme: openThemePanel ?? undefined, placeholder: "0" })] })] }));
};
