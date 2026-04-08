import { useCanvasStore } from '@store/canvasSlice';
import { ColorInput } from '../controls/ColorInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

export const BackgroundSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  return (
    <Section title="Background">
      <Row label="Color">
        <ColorInput
          value={element.backgroundColor}
          onChange={(value) => patchElement(elementId, { backgroundColor: value })}
        />
      </Row>
    </Section>
  );
};
