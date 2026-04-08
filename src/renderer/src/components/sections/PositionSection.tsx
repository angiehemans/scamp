import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

/**
 * X / Y inputs for elements that are absolute-positioned within their
 * parent. Hidden by the parent panel when the element's parent is a flex
 * container — flex layout owns placement in that case.
 */
export const PositionSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  return (
    <Section title="Position">
      <Row label="X">
        <NumberInput
          value={element.x}
          onChange={(value) => patchElement(elementId, { x: value ?? 0 })}
        />
      </Row>
      <Row label="Y">
        <NumberInput
          value={element.y}
          onChange={(value) => patchElement(elementId, { y: value ?? 0 })}
        />
      </Row>
    </Section>
  );
};
