import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { EnumSelect } from '../controls/EnumSelect';
import { SegmentedControl } from '../controls/SegmentedControl';
import type {
  AlignItems,
  DisplayMode,
  FlexDirection,
  JustifyContent,
} from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const DISPLAY_OPTIONS: ReadonlyArray<{ value: DisplayMode; label: string }> = [
  { value: 'none', label: 'Block' },
  { value: 'flex', label: 'Flex' },
];

const DIRECTION_OPTIONS: ReadonlyArray<{ value: FlexDirection; label: string }> = [
  { value: 'row', label: '→ Row' },
  { value: 'column', label: '↓ Col' },
];

const ALIGN_OPTIONS: ReadonlyArray<{ value: AlignItems; label: string }> = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
];

const JUSTIFY_OPTIONS: ReadonlyArray<{ value: JustifyContent; label: string }> = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Between' },
  { value: 'space-around', label: 'Around' },
];

export const LayoutSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  const isFlex = element.display === 'flex';

  return (
    <Section title="Layout">
      <Row label="">
        <SegmentedControl<DisplayMode>
          value={element.display}
          options={DISPLAY_OPTIONS}
          onChange={(value) => patchElement(elementId, { display: value })}
          title="Display mode"
        />
        {isFlex && (
          <SegmentedControl<FlexDirection>
            value={element.flexDirection}
            options={DIRECTION_OPTIONS}
            onChange={(value) => patchElement(elementId, { flexDirection: value })}
            title="Flex direction"
          />
        )}
      </Row>
      {isFlex && (
        <>
          <Row label="">
            <EnumSelect<AlignItems>
              value={element.alignItems}
              options={ALIGN_OPTIONS}
              onChange={(value) => patchElement(elementId, { alignItems: value })}
              title="Align items"
            />
            <EnumSelect<JustifyContent>
              value={element.justifyContent}
              options={JUSTIFY_OPTIONS}
              onChange={(value) => patchElement(elementId, { justifyContent: value })}
              title="Justify content"
            />
          </Row>
          <Row label="">
            <NumberInput
              prefix="Gap"
              title="Gap between flex children"
              value={element.gap}
              onChange={(value) => patchElement(elementId, { gap: value ?? 0 })}
              min={0}
            />
          </Row>
        </>
      )}
    </Section>
  );
};
