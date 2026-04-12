import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { EnumSelect } from '../controls/EnumSelect';
import type { WidthMode, HeightMode } from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const WIDTH_MODE_OPTIONS: ReadonlyArray<{ value: WidthMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'fit-content', label: 'Hug' },
  { value: 'auto', label: 'Auto' },
];

const HEIGHT_MODE_OPTIONS: ReadonlyArray<{ value: HeightMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'fit-content', label: 'Hug' },
  { value: 'auto', label: 'Auto' },
];

/**
 * Measure the actual rendered size of an element on the canvas.
 * Returns undefined if the element isn't mounted.
 */
const useMeasuredSize = (
  elementId: string,
  widthMode: WidthMode,
  heightMode: HeightMode
): { width: number | undefined; height: number | undefined } => {
  const [size, setSize] = useState<{ width: number | undefined; height: number | undefined }>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // Only measure when a non-fixed mode needs a computed value.
    if (widthMode === 'fixed' && heightMode === 'fixed') {
      setSize({ width: undefined, height: undefined });
      return;
    }

    const measure = (): void => {
      const node = document.querySelector(`[data-element-id="${elementId}"]`);
      if (!(node instanceof HTMLElement)) {
        setSize({ width: undefined, height: undefined });
        return;
      }
      setSize({
        width: widthMode !== 'fixed' ? Math.round(node.offsetWidth) : undefined,
        height: heightMode !== 'fixed' ? Math.round(node.offsetHeight) : undefined,
      });
    };

    measure();
    // Re-measure periodically while mounted since layout can change.
    const interval = setInterval(measure, 500);
    return () => clearInterval(interval);
  }, [elementId, widthMode, heightMode]);

  return size;
};

export const SizeSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  const measured = useMeasuredSize(elementId, element.widthMode, element.heightMode);
  const isWidthFixed = element.widthMode === 'fixed';
  const isHeightFixed = element.heightMode === 'fixed';

  return (
    <Section title="Size">
      <Row label="">
        <NumberInput
          prefix="W"
          title="Width"
          value={isWidthFixed ? element.widthValue : measured.width}
          onChange={(value) =>
            patchElement(elementId, { widthMode: 'fixed', widthValue: value ?? 0 })
          }
          min={0}
          placeholder={isWidthFixed ? undefined : element.widthMode}
        />
        <EnumSelect<WidthMode>
          value={element.widthMode}
          options={WIDTH_MODE_OPTIONS}
          onChange={(mode) => patchElement(elementId, { widthMode: mode })}
          title="Width mode"
        />
      </Row>
      <Row label="">
        <NumberInput
          prefix="H"
          title="Height"
          value={isHeightFixed ? element.heightValue : measured.height}
          onChange={(value) =>
            patchElement(elementId, { heightMode: 'fixed', heightValue: value ?? 0 })
          }
          min={0}
          placeholder={isHeightFixed ? undefined : element.heightMode}
        />
        <EnumSelect<HeightMode>
          value={element.heightMode}
          options={HEIGHT_MODE_OPTIONS}
          onChange={(mode) => patchElement(elementId, { heightMode: mode })}
          title="Height mode"
        />
      </Row>
    </Section>
  );
};

export const RootSizeSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  if (!element) return null;

  return (
    <Section title="Page size">
      <Row label="">
        <NumberInput
          prefix="W"
          title="Width"
          value={element.widthValue}
          onChange={(value) => patchElement(elementId, { widthValue: value ?? 0 })}
          min={0}
        />
        <NumberInput
          prefix="H"
          title="Min height"
          value={element.heightValue}
          onChange={(value) => patchElement(elementId, { heightValue: value ?? 0 })}
          min={0}
        />
      </Row>
    </Section>
  );
};
