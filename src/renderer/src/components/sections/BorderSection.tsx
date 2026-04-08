import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { ColorInput } from '../controls/ColorInput';
import { EnumSelect } from '../controls/EnumSelect';
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
  if (!element) return null;

  return (
    <Section title="Border">
      <Row label="Width">
        <NumberInput
          value={element.borderWidth}
          onChange={(value) => patchElement(elementId, { borderWidth: value ?? 0 })}
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
        />
      </Row>
      <Row label="Radius">
        <NumberInput
          value={element.borderRadius}
          onChange={(value) => patchElement(elementId, { borderRadius: value ?? 0 })}
          min={0}
        />
      </Row>
    </Section>
  );
};
