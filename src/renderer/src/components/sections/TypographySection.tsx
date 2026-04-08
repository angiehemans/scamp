import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { ColorInput } from '../controls/ColorInput';
import { EnumSelect } from '../controls/EnumSelect';
import { SegmentedControl } from '../controls/SegmentedControl';
import type { FontWeight, TextAlign } from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const FONT_WEIGHT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '400', label: '400 Regular' },
  { value: '500', label: '500 Medium' },
  { value: '600', label: '600 Semibold' },
  { value: '700', label: '700 Bold' },
];

const TEXT_ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const isFontWeight = (n: number): n is FontWeight =>
  n === 400 || n === 500 || n === 600 || n === 700;

export const TypographySection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element || element.type !== 'text') return null;

  return (
    <Section title="Typography">
      <Row label="Size">
        <NumberInput
          value={element.fontSize}
          onChange={(value) => patchElement(elementId, { fontSize: value })}
          min={1}
          allowEmpty
          placeholder="auto"
        />
      </Row>
      <Row label="Weight">
        <EnumSelect
          value={String(element.fontWeight ?? 400)}
          options={FONT_WEIGHT_OPTIONS}
          onChange={(value) => {
            const n = Number(value);
            if (isFontWeight(n)) patchElement(elementId, { fontWeight: n });
          }}
        />
      </Row>
      <Row label="Color">
        <ColorInput
          value={element.color ?? '#000000'}
          onChange={(value) => patchElement(elementId, { color: value })}
        />
      </Row>
      <Row label="Align">
        <SegmentedControl<TextAlign>
          value={element.textAlign ?? 'left'}
          options={TEXT_ALIGN_OPTIONS}
          onChange={(value) => patchElement(elementId, { textAlign: value })}
        />
      </Row>
      <Row label="Line height">
        <NumberInput
          value={element.lineHeight}
          onChange={(value) => patchElement(elementId, { lineHeight: value })}
          allowEmpty
          placeholder="auto"
        />
      </Row>
      <Row label="Letter sp.">
        <NumberInput
          value={element.letterSpacing}
          onChange={(value) => patchElement(elementId, { letterSpacing: value })}
          allowEmpty
          placeholder="0"
        />
      </Row>
    </Section>
  );
};
