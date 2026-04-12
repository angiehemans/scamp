import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

export const PositionSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  return (
    <Section title="Position">
      <Row label="">
        <NumberInput
          prefix="X"
          title="X position"
          value={element.x}
          onChange={(value) => patchElement(elementId, { x: value ?? 0 })}
        />
        <NumberInput
          prefix="Y"
          title="Y position"
          value={element.y}
          onChange={(value) => patchElement(elementId, { y: value ?? 0 })}
        />
      </Row>
    </Section>
  );
};
