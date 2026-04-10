import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { NumberInput } from '../controls/NumberInput';
import { ColorInput } from '../controls/ColorInput';
import { EnumSelect } from '../controls/EnumSelect';
import { SegmentedControl } from '../controls/SegmentedControl';
import type { FontWeight, TextAlign } from '@lib/element';
import { Section, Row } from './Section';

type Props = {
  elementId: string;
};

/**
 * Font options. The `value` is the full `font-family` CSS value including
 * generic fallback, so the browser picks the right category even when the
 * exact font isn't installed (common on Linux). The label is the
 * human-friendly display name in the dropdown.
 */
const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'System font' },
  // ---- Sans-serif (Google Fonts) ----
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Source Sans 3, sans-serif', label: 'Source Sans 3' },
  { value: 'Nunito, sans-serif', label: 'Nunito' },
  { value: 'Raleway, sans-serif', label: 'Raleway' },
  { value: 'Ubuntu, sans-serif', label: 'Ubuntu' },
  // ---- Sans-serif (web-safe) ----
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial / Helvetica' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  // ---- Serif (Google Fonts) ----
  { value: 'Playfair Display, serif', label: 'Playfair Display' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  // ---- Serif (web-safe) ----
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  // ---- Monospace ----
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
  { value: 'Ubuntu Mono, monospace', label: 'Ubuntu Mono' },
];

const FONT_WEIGHT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '400', label: '400 Regular' },
  { value: '500', label: '500 Medium' },
  { value: '600', label: '600 Semibold' },
  { value: '700', label: '700 Bold' },
];

const TEXT_ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const isFontWeight = (n: number): n is FontWeight =>
  n === 400 || n === 500 || n === 600 || n === 700;

export const TypographySection = ({ elementId }: Props): JSX.Element | null => {
  const element = useCanvasStore((s) => s.elements[elementId]);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const projectColors = useCanvasStore(selectProjectColors);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const openThemePanel = useCanvasStore((s) => s.openThemePanel);
  if (!element || element.type !== 'text') return null;

  return (
    <Section title="Typography">
      <Row label="Font">
        <EnumSelect
          value={element.fontFamily ?? ''}
          options={FONT_FAMILY_OPTIONS}
          onChange={(value) =>
            patchElement(elementId, { fontFamily: value.length > 0 ? value : undefined })
          }
        />
      </Row>
      <Row label="Size">
        <NumberInput
          value={element.fontSize}
          onChange={(value) => patchElement(elementId, { fontSize: value })}
          min={1}
          allowEmpty
          placeholder="auto"
        />
      </Row>
      <Row label="Weight">
        <EnumSelect
          value={String(element.fontWeight ?? 400)}
          options={FONT_WEIGHT_OPTIONS}
          onChange={(value) => {
            const n = Number(value);
            if (isFontWeight(n)) patchElement(elementId, { fontWeight: n });
          }}
        />
      </Row>
      <Row label="Color">
        <ColorInput
          value={element.color ?? '#000000'}
          onChange={(value) => patchElement(elementId, { color: value })}
          presetColors={projectColors.length > 0 ? projectColors : undefined}
          tokens={themeTokens}
          onOpenTheme={openThemePanel ?? undefined}
        />
      </Row>
      <Row label="Align">
        <SegmentedControl<TextAlign>
          value={element.textAlign ?? 'left'}
          options={TEXT_ALIGN_OPTIONS}
          onChange={(value) => patchElement(elementId, { textAlign: value })}
        />
      </Row>
      <Row label="Line height">
        <NumberInput
          value={element.lineHeight}
          onChange={(value) => patchElement(elementId, { lineHeight: value })}
          allowEmpty
          placeholder="auto"
        />
      </Row>
      <Row label="Letter sp.">
        <NumberInput
          value={element.letterSpacing}
          onChange={(value) => patchElement(elementId, { letterSpacing: value })}
          allowEmpty
          placeholder="0"
        />
      </Row>
    </Section>
  );
};
