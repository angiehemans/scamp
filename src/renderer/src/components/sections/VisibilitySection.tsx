import { IconPercentage } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { NumberInput } from '../controls/NumberInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

type VisibilityMode = 'visible' | 'hidden' | 'none';

const VISIBILITY_OPTIONS: ReadonlyArray<{ value: VisibilityMode; label: string }> = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'none', label: 'None' },
];

/** Map 0–1 opacity in the model to a 0–100 integer percent for the UI. */
const toPercent = (opacity: number): number => Math.round(opacity * 100);

export const VisibilitySection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  const currentPercent = toPercent(element.opacity);

  const commitPercent = (next: number | undefined): void => {
    if (next === undefined) return;
    const clamped = Math.max(0, Math.min(100, next));
    patchElement(elementId, { opacity: clamped / 100 });
  };

  return (
    <Section
      title="Visibility"
      elementId={elementId}
      fields={['opacity', 'visibilityMode']}
    >
      <Row label="Opacity">
        <NumberInput
          value={currentPercent}
          onChange={commitPercent}
          min={0}
          max={100}
          title="Opacity (%)"
          suffix={<IconPercentage size={14} stroke={1.75} />}
        />
      </Row>
      <Row label="Display">
        <SegmentedControl<VisibilityMode>
          value={element.visibilityMode}
          options={VISIBILITY_OPTIONS}
          onChange={(value) => patchElement(elementId, { visibilityMode: value })}
          title="Visibility"
        />
      </Row>
    </Section>
  );
};
