import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { EnumSelect } from '../controls/EnumSelect';
import type { WidthMode, HeightMode } from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const MODE_OPTIONS: ReadonlyArray<{ value: WidthMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'fit-content', label: 'Fit content' },
  { value: 'auto', label: 'Auto' },
];

export const SizeSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  const widthDisabled = element.widthMode !== 'fixed';
  const heightDisabled = element.heightMode !== 'fixed';

  return (
    <Section title="Size">
      <Row label="Width">
        <EnumSelect<WidthMode>
          value={element.widthMode}
          options={MODE_OPTIONS}
          onChange={(mode) => patchElement(elementId, { widthMode: mode })}
        />
        {!widthDisabled && (
          <NumberInput
            value={element.widthValue}
            onChange={(value) =>
              patchElement(elementId, { widthMode: 'fixed', widthValue: value ?? 0 })
            }
            min={0}
          />
        )}
      </Row>
      <Row label="Height">
        <EnumSelect<HeightMode>
          value={element.heightMode}
          options={MODE_OPTIONS as ReadonlyArray<{ value: HeightMode; label: string }>}
          onChange={(mode) => patchElement(elementId, { heightMode: mode })}
        />
        {!heightDisabled && (
          <NumberInput
            value={element.heightValue}
            onChange={(value) =>
              patchElement(elementId, { heightMode: 'fixed', heightValue: value ?? 0 })
            }
            min={0}
          />
        )}
      </Row>
    </Section>
  );
};

/**
 * Variant of SizeSection used for the page root: a width input and a
 * min-height input, no mode dropdowns. The root is always fixed-width and
 * grows vertically with content (the generator emits `min-height`).
 */
export const RootSizeSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  return (
    <Section title="Page size">
      <Row label="Width">
        <NumberInput
          value={element.widthValue}
          onChange={(value) => patchElement(elementId, { widthValue: value ?? 0 })}
          min={0}
        />
      </Row>
      <Row label="Min height">
        <NumberInput
          value={element.heightValue}
          onChange={(value) => patchElement(elementId, { heightValue: value ?? 0 })}
          min={0}
        />
      </Row>
    </Section>
  );
};
