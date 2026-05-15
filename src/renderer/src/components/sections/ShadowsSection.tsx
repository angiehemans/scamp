import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import type { BoxShadowDef } from '@lib/element';
import { combineShadowColor, splitShadowColor } from '@lib/parsers';
import type { ThemeToken } from '@shared/types';
import { ColorInput } from '../controls/ColorInput';
import { NumberInput } from '../controls/NumberInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import sectionStyles from './Section.module.css';
import styles from './ShadowsSection.module.css';

type Props = {
  elementId: string;
};

const DEFAULT_NEW_SHADOW: BoxShadowDef = {
  offsetX: 0,
  offsetY: 4,
  blur: 8,
  spread: 0,
  color: 'rgba(0, 0, 0, 0.15)',
  inset: false,
};

type InsetMode = 'outset' | 'inset';

const INSET_OPTIONS: ReadonlyArray<{ value: InsetMode; label: string }> = [
  { value: 'outset', label: 'Outset' },
  { value: 'inset', label: 'Inset' },
];

export const ShadowsSection = ({ elementId }: Props): JSX.Element | null => {
  const element = useResolvedElement(elementId);
  const patchElement = useCanvasStore((s) => s.patchElement);
  const projectColors = useCanvasStore(selectProjectColors);
  const themeTokens = useCanvasStore((s) => s.themeTokens);
  const openThemePanel = useCanvasStore((s) => s.openThemePanel);
  const groupToggle = useGroupToggle(elementId, 'shadow');
  if (!element) return null;

  const shadows: ReadonlyArray<BoxShadowDef> = element.boxShadows;
  // Hide the eye when there are no shadows defined (or already off).
  const effectiveGroupToggle =
    shadows.length > 0 || !groupToggle.isOn ? groupToggle : undefined;

  const setShadows = (next: ReadonlyArray<BoxShadowDef>): void => {
    patchElement(elementId, { boxShadows: next });
  };

  const updateRow = (idx: number, patch: Partial<BoxShadowDef>): void => {
    setShadows(shadows.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeRow = (idx: number): void => {
    setShadows(shadows.filter((_, i) => i !== idx));
  };

  const addRow = (): void => {
    setShadows([...shadows, { ...DEFAULT_NEW_SHADOW }]);
  };

  return (
    <Section
      title="Shadow"
      collapsible
      defaultOpen={shadows.length > 0}
      elementId={elementId}
      groupToggle={effectiveGroupToggle}
      fields={['boxShadows']}
      cssProperties={['box-shadow']}
    >
      {shadows.length === 0 && (
        <div className={sectionStyles.row}>
          <span
            className={sectionStyles.rowLabel}
            data-testid="shadows-empty"
          >
            None
          </span>
        </div>
      )}
      {shadows.map((shadow, idx) => (
        <ShadowRow
          key={idx}
          index={idx}
          shadow={shadow}
          elementId={elementId}
          onChange={(patch) => updateRow(idx, patch)}
          onRemove={() => removeRow(idx)}
          projectColors={projectColors}
          themeTokens={themeTokens}
          onOpenTheme={openThemePanel ?? undefined}
        />
      ))}
      <Row label="">
        <button
          type="button"
          className={sectionStyles.rowAddButton}
          onClick={addRow}
        >
          + Add shadow
        </button>
      </Row>
    </Section>
  );
};

type RowProps = {
  index: number;
  shadow: BoxShadowDef;
  /** Element this shadow row edits — passed to the picker's history entry. */
  elementId: string;
  onChange: (patch: Partial<BoxShadowDef>) => void;
  onRemove: () => void;
  projectColors: ReadonlyArray<string>;
  themeTokens: ReadonlyArray<ThemeToken>;
  onOpenTheme?: () => void;
};

const ShadowRow = ({
  index,
  shadow,
  elementId,
  onChange,
  onRemove,
  projectColors,
  themeTokens,
  onOpenTheme,
}: RowProps): JSX.Element => {
  return (
    <div className={styles.shadowRow}>
      <div className={styles.rowHeader}>
        <span className={styles.rowTitle}>
          Shadow {index + 1}
          {shadow.inset && (
            <Tooltip label="Inset shadow — drawn inside the box">
              <span className={styles.insetIcon} aria-hidden="true">
                ◧
              </span>
            </Tooltip>
          )}
        </span>
        <Tooltip label="Remove shadow">
          <button
            type="button"
            className={sectionStyles.rowRemoveButton}
            onClick={onRemove}
            aria-label={`Remove shadow ${index + 1}`}
          >
            ×
          </button>
        </Tooltip>
      </div>
      <Row label="">
        <SegmentedControl<InsetMode>
          value={shadow.inset ? 'inset' : 'outset'}
          options={INSET_OPTIONS}
          onChange={(next) => onChange({ inset: next === 'inset' })}
          title="Inset shadows are drawn inside the box rather than around it"
        />
      </Row>
      <Row label="">
        <NumberInput
          prefix="X"
          title="X offset"
          value={shadow.offsetX}
          onChange={(value) =>
            value !== undefined && onChange({ offsetX: value })
          }
        />
        <NumberInput
          prefix="Y"
          title="Y offset"
          value={shadow.offsetY}
          onChange={(value) =>
            value !== undefined && onChange({ offsetY: value })
          }
        />
      </Row>
      <Row label="">
        <NumberInput
          prefix="B"
          title="Blur radius"
          value={shadow.blur}
          onChange={(value) =>
            value !== undefined && onChange({ blur: value })
          }
          min={0}
        />
        <NumberInput
          prefix="S"
          title="Spread radius"
          value={shadow.spread}
          onChange={(value) =>
            value !== undefined && onChange({ spread: value })
          }
        />
      </Row>
      <Row label="">
        <ShadowColorRow
          color={shadow.color}
          elementId={elementId}
          onChange={(color) => onChange({ color })}
          projectColors={projectColors}
          themeTokens={themeTokens}
          onOpenTheme={onOpenTheme}
        />
      </Row>
    </div>
  );
};

type ColorRowProps = {
  color: string;
  /** Element id for the picker's history entry tag. */
  elementId: string;
  onChange: (next: string) => void;
  projectColors: ReadonlyArray<string>;
  themeTokens: ReadonlyArray<ThemeToken>;
  onOpenTheme?: () => void;
};

/**
 * Splits the stored shadow color into a base hex (rendered through
 * ColorInput with `disableAlpha`) and an opacity percentage (rendered
 * as a separate NumberInput). Edits to either control re-combine into
 * an `rgba(...)` string the data layer stores.
 *
 * Token / named-color values can't be combined with a separate alpha
 * (you'd lose the reference), so the opacity input is disabled in
 * that case — the picker still lets the user switch back to a hex.
 */
const ShadowColorRow = ({
  color,
  elementId,
  onChange,
  projectColors,
  themeTokens,
  onOpenTheme,
}: ColorRowProps): JSX.Element => {
  const split = splitShadowColor(color);
  const opacityPercent = Math.round(split.alpha * 100);

  const handleColorChange = (next: string): void => {
    const nextSplit = splitShadowColor(next);
    if (!nextSplit.decomposable) {
      // var() / token / named — keep verbatim, can't carry separate
      // opacity here.
      onChange(next);
      return;
    }
    // The picker's `disableAlpha` keeps the SketchPicker's alpha at 1,
    // but the user might still type an `rgba(..., 0.5)` into the text
    // field. When they do, treat that explicit alpha as the new
    // opacity; otherwise carry the existing opacity over so changing
    // the hue doesn't reset the slider.
    const alpha = nextSplit.hasExplicitAlpha ? nextSplit.alpha : split.alpha;
    onChange(combineShadowColor(nextSplit.base, alpha));
  };

  const handleOpacityChange = (percent: number | undefined): void => {
    if (percent === undefined) return;
    const clamped = Math.max(0, Math.min(100, percent));
    if (!split.decomposable) return;
    onChange(combineShadowColor(split.base, clamped / 100));
  };

  return (
    <>
      <ColorInput
        value={color}
        onChange={handleColorChange}
        historyElementId={elementId}
        historyPropertyKey="boxShadows"
        presetColors={projectColors.length > 0 ? projectColors : undefined}
        tokens={themeTokens}
        onOpenTheme={onOpenTheme}
        disableAlpha
      />
      <NumberInput
        prefix="O"
        suffix="%"
        title={
          split.decomposable
            ? 'Shadow opacity (0–100)'
            : 'Opacity is disabled for token / named-color shadows. Pick a hex color to enable.'
        }
        value={opacityPercent}
        onChange={handleOpacityChange}
        min={0}
        max={100}
        disabled={!split.decomposable}
      />
    </>
  );
};
