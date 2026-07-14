import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext } from '@store/hooks/useColorPickerContext';
import { useResolvedElement } from '@store/useResolvedElement';
import { extractSvgColors, replaceSvgColor } from '@renderer/src/lib/svg';
import type { ScampElement } from '@lib/element';
import { ColorInput } from '../controls/ColorInput';
import { NumberInput } from '../controls/NumberInput';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

const isConcreteColor = (value: string | undefined): value is string => {
  if (!value) return false;
  const lower = value.trim().toLowerCase();
  return lower.length > 0 && lower !== 'none' && lower !== 'currentcolor';
};

const usesCurrentColor = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === 'currentcolor';

type Swatch = {
  /** Dedupe/react key — the lowercased colour value. */
  key: string;
  label: string;
  value: string;
  /** History grouping key; omitted for the currentColor swatch (which
   *  writes to customProperties, not a typed field). */
  historyKey?: keyof ScampElement;
  onChange: (value: string) => void;
};

/**
 * SVG Colours + stroke width for an inline `<svg>` element. Surfaces every
 * unique colour in the artwork as an editable swatch: concrete colours in
 * the source are rewritten in `svgSource`; the root-hoisted `fill`/`stroke`
 * are edited as typed fields; and `currentColor` maps to the element's CSS
 * `color`. Rendered by UiPanel only when `tag === 'svg'`.
 * see docs/plans/svg-color-editing-plan.md
 */
export const SvgSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const { presetColors, themeTokens, onOpenTheme } = useColorPickerContext();
  if (!element) return null;

  const source = element.svgSource ?? '';
  const { colors, hasCurrentColor } = extractSvgColors(source);

  // Assemble the swatch list, deduped by colour value across all sources
  // (root paint, per-shape source colours). First occurrence wins.
  const swatches: Swatch[] = [];
  const seen = new Set<string>();
  const push = (
    value: string,
    label: string,
    onChange: (v: string) => void,
    historyKey?: keyof ScampElement
  ): void => {
    if (!isConcreteColor(value)) return;
    const key = value.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    swatches.push({ key, label, value, historyKey, onChange });
  };

  // Root-hoisted paint (lives on the regenerated wrapper, not in svgSource).
  push(
    element.fill ?? '',
    'Fill',
    (v) => patchElement(elementId, { fill: v }),
    'fill'
  );
  push(
    element.stroke ?? '',
    'Stroke',
    (v) => patchElement(elementId, { stroke: v }),
    'stroke'
  );
  // Per-shape colours inside the artwork — rewritten in the source.
  for (const color of colors) {
    push(
      color,
      'Colour',
      (v) =>
        patchElement(elementId, { svgSource: replaceSvgColor(source, color, v) }),
      'svgSource'
    );
  }

  // currentColor → the element's CSS `color` (typed field, so it round-
  // trips through generate/parse). Shown whenever any paint (source or
  // root) resolves to currentColor.
  const showCurrentColor =
    hasCurrentColor ||
    usesCurrentColor(element.fill) ||
    usesCurrentColor(element.stroke);
  const currentColorValue = element.color ?? '';

  const hasAnyColor = swatches.length > 0 || showCurrentColor;

  return (
    <Section
      title="SVG"
      elementId={elementId}
      fields={['fill', 'stroke', 'strokeWidth']}
      cssProperties={['fill', 'stroke', 'stroke-width', 'color']}
    >
      {swatches.map((swatch) => (
        <Row key={swatch.key} label={swatch.label}>
          <ColorInput
            value={swatch.value}
            onChange={swatch.onChange}
            historyElementId={elementId}
            historyPropertyKey={swatch.historyKey}
            presetColors={presetColors}
            tokens={themeTokens}
            onOpenTheme={onOpenTheme}
          />
        </Row>
      ))}
      {showCurrentColor && (
        <Row label="Current color">
          <ColorInput
            value={currentColorValue}
            onChange={(v) => patchElement(elementId, { color: v })}
            historyElementId={elementId}
            historyPropertyKey="color"
            presetColors={presetColors}
            tokens={themeTokens}
            onOpenTheme={onOpenTheme}
          />
        </Row>
      )}
      {!hasAnyColor && (
        <Row label="Colours">
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            No editable colours
          </span>
        </Row>
      )}
      <Row label="Stroke width">
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
