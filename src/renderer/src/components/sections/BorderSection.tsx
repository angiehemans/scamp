import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { ColorInput } from '../controls/ColorInput';
import { EnumSelect } from '../controls/EnumSelect';
import { FourSideInput } from '../controls/FourSideInput';
import type { BorderStyle } from '@lib/element';
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
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const projectColors = useCanvasStore(selectProjectColors);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const openThemePanel = useCanvasStore((s) => s.openThemePanel);
  if (!element) return null;

  return (
    <Section title="Border">
      <Row label="Width">
        <FourSideInput
          value={element.borderWidth}
          onChange={(next) => patchElement(elementId, { borderWidth: next })}
          min={0}
        />
      </Row>
      <Row label="Style">
        <EnumSelect<BorderStyle>
          value={element.borderStyle}
          options={BORDER_STYLE_OPTIONS}
          onChange={(value) => patchElement(elementId, { borderStyle: value })}
        />
      </Row>
      <Row label="Color">
        <ColorInput
          value={element.borderColor}
          onChange={(value) => patchElement(elementId, { borderColor: value })}
          presetColors={projectColors.length > 0 ? projectColors : undefined}
          tokens={themeTokens}
          onOpenTheme={openThemePanel ?? undefined}
        />
      </Row>
      <Row label="Radius">
        <FourSideInput
          value={element.borderRadius}
          onChange={(next) => patchElement(elementId, { borderRadius: next })}
          min={0}
        />
      </Row>
    </Section>
  );
};
