import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { NumberInput } from '../controls/NumberInput';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import type {
  GridSelfAlign,
  HeightMode,
  WidthMode,
} from '@lib/element';
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

const GRID_SELF_OPTIONS: ReadonlyArray<{ value: GridSelfAlign; label: string }> = [
  { value: 'start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'end', label: 'End' },
  { value: 'stretch', label: 'Stretch' },
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
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  // Whether THIS element's parent is a grid container — drives the
  // grid-item controls below.
  const parentIsGrid = useCanvasStore((s) => {
    if (!elementId) return false;
    const el = s.elements[elementId];
    if (!el?.parentId) return false;
    return s.elements[el.parentId]?.display === 'grid';
  });
  if (!element) return null;

  const measured = useMeasuredSize(elementId, element.widthMode, element.heightMode);
  const isWidthFixed = element.widthMode === 'fixed';
  const isHeightFixed = element.heightMode === 'fixed';

  return (
    <Section
      title="Size"
      elementId={elementId}
      fields={[
        'widthMode',
        'widthValue',
        'heightMode',
        'heightValue',
        'gridColumn',
        'gridRow',
        'alignSelf',
        'justifySelf',
      ]}
    >
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
      {parentIsGrid && (
        <>
          <Row label="">
            <PrefixSuffixInput
              prefix="Col"
              title="grid-column"
              value={element.gridColumn}
              placeholder="span 2"
              onCommit={(value) =>
                patchElement(elementId, { gridColumn: value.trim() })
              }
            />
          </Row>
          <Row label="">
            <PrefixSuffixInput
              prefix="Row"
              title="grid-row"
              value={element.gridRow}
              placeholder="1 / 3"
              onCommit={(value) =>
                patchElement(elementId, { gridRow: value.trim() })
              }
            />
          </Row>
          <Row label="">
            <EnumSelect<GridSelfAlign>
              value={element.alignSelf}
              options={GRID_SELF_OPTIONS}
              onChange={(value) => patchElement(elementId, { alignSelf: value })}
              title="Align self"
            />
            <EnumSelect<GridSelfAlign>
              value={element.justifySelf}
              options={GRID_SELF_OPTIONS}
              onChange={(value) => patchElement(elementId, { justifySelf: value })}
              title="Justify self"
            />
          </Row>
        </>
      )}
    </Section>
  );
};

