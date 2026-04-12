import { useCanvasStore } from '@store/canvasSlice';
import { EnumSelect } from '../controls/EnumSelect';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const TAG_OPTIONS = [
  { value: 'p', label: 'p' },
  { value: 'h1', label: 'h1' },
  { value: 'h2', label: 'h2' },
  { value: 'h3', label: 'h3' },
  { value: 'h4', label: 'h4' },
  { value: 'h5', label: 'h5' },
  { value: 'h6', label: 'h6' },
  { value: 'span', label: 'span' },
  { value: 'a', label: 'a' },
  { value: 'label', label: 'label' },
  { value: 'strong', label: 'strong' },
  { value: 'em', label: 'em' },
] as const;

/**
 * Semantic HTML tag picker for text elements. The default tag for a text
 * element is `p`, so picking `p` clears the override (stores `undefined`)
 * to keep the round-trip text-stable — matches `parseCode`'s storage rule.
 */
export const TagSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element || element.type !== 'text') return null;

  const current = element.tag ?? 'p';

  return (
    <Section title="Tag">
      <Row label="">
        <EnumSelect
          value={current}
          options={TAG_OPTIONS}
          onChange={(value) =>
            patchElement(elementId, { tag: value === 'p' ? undefined : value })
          }
          title="HTML tag"
        />
      </Row>
    </Section>
  );
};
