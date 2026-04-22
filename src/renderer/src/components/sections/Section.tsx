import { useState, type MouseEvent, type ReactNode } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useBreakpointOverrideFields } from '@store/useResolvedElement';
import type { BreakpointOverride } from '@lib/element';
import { Tooltip } from '../controls/Tooltip';
import styles from './Section.module.css';

type Props = {
  title: string;
  children: ReactNode;
  /** When true, the heading acts as a disclosure toggle. */
  collapsible?: boolean;
  /** Initial open state when `collapsible` is true. Ignored otherwise. */
  defaultOpen?: boolean;
  /**
   * The element this section edits. Paired with `fields` to drive
   * the breakpoint-override indicator next to the section title.
   */
  elementId?: string;
  /**
   * Which BreakpointOverride fields this section as a whole manages.
   * When any of them is set in the active breakpoint's override, the
   * title shows a small dot. Hover the dot for a list of overridden
   * properties; right-click to reset them all.
   */
  fields?: ReadonlyArray<keyof BreakpointOverride>;
};

/**
 * Card-like wrapper for one panel section. Renders a small heading
 * (optionally collapsible) and the provided controls.
 *
 * When `elementId` + `fields` are provided, the title surfaces an
 * override indicator that aggregates all breakpoint overrides within
 * this section. Right-click the dot to reset every overridden field
 * in the section at the active breakpoint.
 */
export const Section = ({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  elementId,
  fields,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(defaultOpen);
  const indicator =
    elementId && fields && fields.length > 0 ? (
      <OverrideIndicator elementId={elementId} fields={fields} />
    ) : null;

  if (!collapsible) {
    return (
      <section className={styles.section}>
        <div className={styles.titleRow}>
          <h3 className={styles.heading}>{title}</h3>
          {indicator}
        </div>
        {children}
      </section>
    );
  }

  const handleToggle = (): void => setOpen((v) => !v);
  return (
    <section className={styles.section}>
      <div className={styles.titleRow}>
        <button
          className={styles.toggle}
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
        >
          <span className={styles.caret} aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className={styles.heading}>{title}</span>
        </button>
        {indicator}
      </div>
      {open && children}
    </section>
  );
};

type IndicatorProps = {
  elementId: string;
  fields: ReadonlyArray<keyof BreakpointOverride>;
};

/**
 * Small dot next to the section title that appears when any of the
 * section's fields is overridden at the active breakpoint. Wrapped
 * in a Tooltip that lists the overridden property names in CSS form.
 * Right-click resets all overridden fields at the active breakpoint.
 */
const OverrideIndicator = ({
  elementId,
  fields,
}: IndicatorProps): JSX.Element | null => {
  const overriddenFields = useBreakpointOverrideFields(elementId);
  const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
  const resetFields = useCanvasStore((s) => s.resetElementFieldsAtBreakpoint);

  const overriddenInSection = fields.filter((f) => overriddenFields.has(f));
  if (overriddenInSection.length === 0) return null;

  const label = formatOverrideList(overriddenInSection);

  const handleContextMenu = (e: MouseEvent<HTMLSpanElement>): void => {
    if (activeBreakpointId === 'desktop') return;
    e.preventDefault();
    resetFields(elementId, activeBreakpointId, overriddenInSection);
  };

  return (
    <Tooltip header="Style Overrides" label={label}>
      <span
        className={styles.overrideDot}
        onContextMenu={handleContextMenu}
        aria-label={`Overridden styles: ${label}`}
      />
    </Tooltip>
  );
};

/**
 * Format a list of BreakpointOverride field keys as the body of the
 * section-indicator tooltip. Field pairs that represent one CSS
 * property are deduped (e.g. widthMode + widthValue → "width") so
 * the list reads like CSS, not like internal state.
 *
 * The "Style Overrides" header + border separator is rendered by
 * `Tooltip` itself via its `header` prop; this function returns only
 * the bulleted body.
 */
const formatOverrideList = (
  fields: ReadonlyArray<keyof BreakpointOverride>
): string => {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const field of fields) {
    const label = FIELD_LABELS[field as string] ?? String(field);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels.map((l) => `- ${l}`).join('\n');
};

/** Human-readable CSS names for each BreakpointOverride field. */
const FIELD_LABELS: Record<string, string> = {
  widthMode: 'width',
  widthValue: 'width',
  heightMode: 'height',
  heightValue: 'height',
  x: 'left',
  y: 'top',
  display: 'display',
  flexDirection: 'flex-direction',
  gap: 'gap',
  alignItems: 'align-items',
  justifyContent: 'justify-content',
  padding: 'padding',
  margin: 'margin',
  backgroundColor: 'background',
  borderRadius: 'border-radius',
  borderWidth: 'border-width',
  borderStyle: 'border-style',
  borderColor: 'border-color',
  opacity: 'opacity',
  visibilityMode: 'visibility',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  color: 'color',
  textAlign: 'text-align',
  lineHeight: 'line-height',
  letterSpacing: 'letter-spacing',
  customProperties: 'custom CSS',
};

type RowProps = {
  label: string;
  children: ReactNode;
};

/** A labeled row inside a Section. Wraps the label and the control(s). */
export const Row = ({ label, children }: RowProps): JSX.Element => {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
};
