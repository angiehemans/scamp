import { useMemo } from 'react';
import { IconAlignLeft, IconAlignCenter, IconAlignRight } from '@tabler/icons-react';

import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext } from '@store/hooks/useColorPickerContext';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import { useFontsStore, selectAllFonts } from '@store/fontsSlice';
import { classifyToken } from '@lib/tokenClassify';
import { ColorInput } from '../controls/ColorInput';
import { previewStyle } from '../controls/livePreview';
import { EnumSelect } from '../controls/EnumSelect';
import { FontPicker } from '../controls/FontPicker';
import { SegmentedControl } from '../controls/SegmentedControl';
import { TokenOrNumberInput } from '../controls/TokenOrNumberInput';
import type { FontWeight, TextAlign } from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const FONT_WEIGHT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '400', label: '400' },
  { value: '500', label: '500' },
  { value: '600', label: '600' },
  { value: '700', label: '700' },
];

const ICON_SIZE = 14;

const TEXT_ALIGN_OPTIONS = [
  { value: 'left' as TextAlign, label: <IconAlignLeft size={ICON_SIZE} />, ariaLabel: 'Align left' },
  { value: 'center' as TextAlign, label: <IconAlignCenter size={ICON_SIZE} />, ariaLabel: 'Align center' },
  { value: 'right' as TextAlign, label: <IconAlignRight size={ICON_SIZE} />, ariaLabel: 'Align right' },
] as const;

const isFontWeight = (n: number): n is FontWeight =>
  n === 400 || n === 500 || n === 600 || n === 700;

export const TypographySection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const { presetColors, themeTokens, onOpenTheme } = useColorPickerContext();
  const allFonts = useFontsStore(selectAllFonts);

  // Filter theme tokens by category so each input only offers tokens
  // that make sense for that property.
  const fontSizeTokens = useMemo(
    () => themeTokens.filter((t) => classifyToken(t.value) === 'fontSize'),
    [themeTokens]
  );
  const lineHeightTokens = useMemo(
    () => themeTokens.filter((t) => classifyToken(t.value) === 'lineHeight'),
    [themeTokens]
  );
  const fontFamilyTokens = useMemo(
    () => themeTokens.filter((t) => classifyToken(t.value) === 'fontFamily'),
    [themeTokens]
  );
  const letterSpacingTokens = fontSizeTokens; // lengths work for both
  // Hide the eye when none of the typed typography fields are set
  // (and the group isn't already off — leave it visible so the
  // user can toggle back on).
  const hasTypographyContent =
    element !== undefined &&
    element.type === 'text' &&
    (element.fontFamily !== undefined ||
      element.fontSize !== undefined ||
      element.fontWeight !== undefined ||
      element.color !== undefined ||
      element.textAlign !== undefined ||
      element.lineHeight !== undefined ||
      element.letterSpacing !== undefined);
  const groupToggle = useGroupToggle(
    elementId,
    'typography',
    hasTypographyContent
  );

  if (!element || element.type !== 'text') return null;

  return (
    <Section
      title="Typography"
      elementId={elementId}
      groupToggle={groupToggle}
      fields={[
        'fontFamily',
        'fontSize',
        'fontWeight',
        'color',
        'textAlign',
        'lineHeight',
        'letterSpacing',
      ]}
      cssProperties={[
        'font-family',
        'font-size',
        'font-weight',
        'color',
        'text-align',
        'line-height',
        'letter-spacing',
      ]}
    >
      <Row label="">
        <FontPicker
          value={element.fontFamily ?? ''}
          fonts={allFonts}
          fontTokens={fontFamilyTokens}
          onChange={(value) =>
            patchElement(elementId, {
              fontFamily: value.length > 0 ? value : undefined,
            })
          }
          title="Font family"
        />
      </Row>
      <Row label="">
        <TokenOrNumberInput
          prefix="Sz"
          title="Font size"
          value={element.fontSize}
          tokens={fontSizeTokens}
          defaultUnit="px"
          onChange={(value) => patchElement(elementId, { fontSize: value })}
          onOpenTheme={onOpenTheme}
          placeholder="auto"
        />
        <EnumSelect
          value={String(element.fontWeight ?? 400)}
          options={FONT_WEIGHT_OPTIONS}
          onChange={(value) => {
            const n = Number(value);
            if (isFontWeight(n)) patchElement(elementId, { fontWeight: n });
          }}
          title="Font weight"
        />
      </Row>
      <Row label="">
        <ColorInput
          value={element.color ?? '#000000'}
          onChange={(value) => patchElement(elementId, { color: value })}
          onPreview={previewStyle(elementId, 'color')}
          historyElementId={elementId}
          historyPropertyKey="color"
          presetColors={presetColors}
          tokens={themeTokens}
          onOpenTheme={onOpenTheme}
        />
        <SegmentedControl<TextAlign>
          value={element.textAlign ?? 'left'}
          options={TEXT_ALIGN_OPTIONS}
          onChange={(value) => patchElement(elementId, { textAlign: value })}
          title="Text align"
        />
      </Row>
      <Row label="">
        <TokenOrNumberInput
          prefix="LH"
          title="Line height"
          value={element.lineHeight}
          tokens={lineHeightTokens}
          defaultUnit=""
          onChange={(value) => patchElement(elementId, { lineHeight: value })}
          onOpenTheme={onOpenTheme}
          placeholder="auto"
        />
        <TokenOrNumberInput
          prefix="LS"
          title="Letter spacing"
          value={element.letterSpacing}
          tokens={letterSpacingTokens}
          defaultUnit="px"
          onChange={(value) => patchElement(elementId, { letterSpacing: value })}
          onOpenTheme={onOpenTheme}
          placeholder="0"
        />
      </Row>
    </Section>
  );
};
