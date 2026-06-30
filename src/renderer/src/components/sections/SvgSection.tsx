import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext } from '@store/hooks/useColorPickerContext';
import { useResolvedElement } from '@store/useResolvedElement';
import { ColorInput } from '../controls/ColorInput';
import { NumberInput } from '../controls/NumberInput';
import { previewStyle } from '../controls/livePreview';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

/**
 * Fill / stroke / stroke-width controls for an inline `<svg>` element.
 * Element-level paint cascades to the svg's shapes (whose own fill/stroke
 * were stripped on import), so editing here recolours the icon without
 * touching `svgSource`. Rendered by UiPanel only when `tag === 'svg'`.
 * see docs/plans/svg-improvements-plan.md
 */
export const SvgSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const { presetColors, themeTokens, onOpenTheme } = useColorPickerContext();
  if (!element) return null;

  return (
    <Section
      title="SVG"
      elementId={elementId}
      fields={['fill', 'stroke', 'strokeWidth']}
      cssProperties={['fill', 'stroke', 'stroke-width']}
    >
      <Row label="Fill">
        <ColorInput
          value={element.fill ?? ''}
          onChange={(value) => patchElement(elementId, { fill: value })}
          onPreview={previewStyle(elementId, 'fill')}
          historyElementId={elementId}
          historyPropertyKey="fill"
          presetColors={presetColors}
          tokens={themeTokens}
          onOpenTheme={onOpenTheme}
        />
      </Row>
      <Row label="Stroke">
        <ColorInput
          value={element.stroke ?? ''}
          onChange={(value) => patchElement(elementId, { stroke: value })}
          onPreview={previewStyle(elementId, 'stroke')}
          historyElementId={elementId}
          historyPropertyKey="stroke"
          presetColors={presetColors}
          tokens={themeTokens}
          onOpenTheme={onOpenTheme}
        />
        <NumberInput
          prefix="W"
          title="Stroke width (px)"
          value={element.strokeWidth}
          onChange={(value) => patchElement(elementId, { strokeWidth: value })}
          min={0}
          allowEmpty
        />
      </Row>
    </Section>
  );
};
