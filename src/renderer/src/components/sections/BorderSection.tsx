import { useMemo } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext } from '@store/hooks/useColorPickerContext';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import { ColorInput } from '../controls/ColorInput';
import { previewStyle } from '../controls/livePreview';
import { EnumSelect } from '../controls/EnumSelect';
import { FourSideInput } from '../controls/FourSideInput';
import type { BorderStyle } from '@lib/element';
import { isZeroSpaceTuple } from '@lib/spaceValue';
import { classifyToken } from '@lib/tokenClassify';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const BORDER_STYLE_OPTIONS: ReadonlyArray<{ value: BorderStyle; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export const BorderSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const { presetColors, themeTokens, onOpenTheme } = useColorPickerContext();
  // Hide the eye when no border is set AND no rounded corners.
  // Border radius lives in the same group, so a rounded-but-
  // un-bordered element still has something to toggle. Token-form
  // sides (e.g. `var(--space-md)`) always count as "set" — they're
  // an authored value the user wants visible in the file.
  const hasBorderContent =
    element !== undefined &&
    (element.borderStyle !== 'none' ||
      !isZeroSpaceTuple(element.borderWidth) ||
      !isZeroSpaceTuple(element.borderRadius));
  const groupToggle = useGroupToggle(elementId, 'border', hasBorderContent);
  const spacingTokens = useMemo(
    () => themeTokens.filter((t) => classifyToken(t.value) === 'fontSize'),
    [themeTokens]
  );
  if (!element) return null;

  return (
    <Section
      title="Border"
      elementId={elementId}
      groupToggle={groupToggle}
      fields={['borderColor', 'borderStyle', 'borderWidth', 'borderRadius']}
      cssProperties={[
        'border',
        'border-width',
        'border-style',
        'border-color',
        'border-radius',
      ]}
    >
      <Row label="">
        <ColorInput
          value={element.borderColor}
          onChange={(value) => patchElement(elementId, { borderColor: value })}
          onPreview={previewStyle(elementId, 'borderColor')}
          historyElementId={elementId}
          historyPropertyKey="borderColor"
          presetColors={presetColors}
          tokens={themeTokens}
          onOpenTheme={onOpenTheme}
        />
        <EnumSelect<BorderStyle>
          value={element.borderStyle}
          options={BORDER_STYLE_OPTIONS}
          onChange={(value) => patchElement(elementId, { borderStyle: value })}
          title="Border style"
        />
      </Row>
      <Row label="">
        <FourSideInput
          prefix="W"
          title="Border width (top right bottom left)"
          value={element.borderWidth}
          onChange={(next) => patchElement(elementId, { borderWidth: next })}
          min={0}
          tokens={spacingTokens}
          onOpenTheme={onOpenTheme}
        />
        <FourSideInput
          prefix="R"
          title="Border radius (top-left top-right bottom-right bottom-left)"
          value={element.borderRadius}
          onChange={(next) => patchElement(elementId, { borderRadius: next })}
          min={0}
          tokens={spacingTokens}
          onOpenTheme={onOpenTheme}
        />
      </Row>
    </Section>
  );
};
