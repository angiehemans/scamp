import { useCanvasStore } from '@store/canvasSlice';
import { FourSideInput } from '../controls/FourSideInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
  hideMargin?: boolean;
};

export const SpacingSection = ({ elementId, hideMargin = false }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  return (
    <Section title="Spacing">
      <Row label="">
        <FourSideInput
          prefix="P"
          title="Padding (top right bottom left)"
          value={element.padding}
          onChange={(next) => patchElement(elementId, { padding: next })}
          min={0}
        />
        {!hideMargin && (
          <FourSideInput
            prefix="M"
            title="Margin (top right bottom left)"
            value={element.margin}
            onChange={(next) => patchElement(elementId, { margin: next })}
          />
        )}
      </Row>
    </Section>
  );
};
