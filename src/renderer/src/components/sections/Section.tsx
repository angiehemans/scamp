import { useState, type MouseEvent, type ReactNode } from 'react';
import { IconChevronDown, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import {
  useBreakpointOverrideFields,
  useStateOverrideFields,
} from '@store/useResolvedElement';
import type { BreakpointOverride } from '@lib/element';
import { FIELD_LABELS } from '@lib/fieldLabels';
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
  /**
   * The CSS property names this section emits / controls. Used to
   * surface a separate warning indicator when the parser saw the
   * same declaration twice in the element's class block. The names
   * are CSS-form (`'border-color'`, `'height'`, …) since the parser
   * tracks duplicates in CSS-property terms.
   */
  cssProperties?: ReadonlyArray<string>;
  /**
   * Group-toggle slot. When provided, the section's title row
   * renders a small eye-icon button that flips the whole group
   * off / on. The section's content dims (50% opacity,
   * `pointer-events: none`) when `isOn` is false so the inactive
   * state is unmistakable.
   *
   * Omit on sections that aren't CSS-property groups (Element,
   * Position, Size, Layout, Visibility, Export — see
   * `propertyGroups.ts` for the rationale on the latter three).
   */
  groupToggle?: {
    isOn: boolean;
    onChange: (on: boolean) => void;
    /** Human-readable group name for the tooltip
     *  ("Hide Shadow" / "Show Shadow"). Defaults to the
     *  section's `title`. */
    label?: string;
  };
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
  cssProperties,
  groupToggle,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(defaultOpen);
  const overrideInfo = useOverrideIndicator(elementId, fields);
  const duplicateInfo = useDuplicateIndicator(elementId, cssProperties);

  // Eye-icon toggle button rendered when this section is part of
  // the togglable-group taxonomy. Visible regardless of the
  // section's collapse state so the user can flip without
  // expanding first.
  const groupLabel = groupToggle?.label ?? title;
  const groupToggleButton = groupToggle ? (
    <Tooltip label={groupToggle.isOn ? `Hide ${groupLabel}` : `Show ${groupLabel}`}>
      <button
        type="button"
        className={styles.groupToggleButton}
        onClick={(e) => {
          // Stop propagation so clicking the toggle doesn't
          // also collapse the section (when the title row IS the
          // collapse button).
          e.stopPropagation();
          groupToggle.onChange(!groupToggle.isOn);
        }}
        aria-label={groupToggle.isOn ? `Hide ${groupLabel}` : `Show ${groupLabel}`}
        aria-pressed={!groupToggle.isOn}
      >
        {groupToggle.isOn ? (
          <IconEye size={14} stroke={2} />
        ) : (
          <IconEyeOff size={14} stroke={2} />
        )}
      </button>
    </Tooltip>
  ) : null;
  const groupOff = groupToggle?.isOn === false;

  // Pick the tooltip whose header / body wraps the title row when an
  // indicator is active. Duplicates take priority because they signal
  // a bug-shaped condition the user probably wants to investigate
  // before tweaking overrides. When both are active, the override dot
  // is still rendered (and right-clickable to reset) but its tooltip
  // doesn't claim the wider title-row hit area.
  const tooltipInfo = duplicateInfo ?? overrideInfo;

  const duplicateDot = duplicateInfo ? (
    <span
      className={styles.duplicateDot}
      aria-label={duplicateInfo.ariaLabel}
      data-testid="duplicate-dot"
    />
  ) : null;
  const overrideDot = overrideInfo ? (
    <span
      className={styles.overrideDot}
      onContextMenu={overrideInfo.onContextMenu}
      aria-label={overrideInfo.ariaLabel}
      data-testid="override-dot"
    />
  ) : null;

  const wrapWithTooltip = (node: JSX.Element): JSX.Element => {
    if (!tooltipInfo) return node;
    return (
      <Tooltip header={tooltipInfo.header} label={tooltipInfo.label}>
        {node}
      </Tooltip>
    );
  };

  // Wrap children only when this section has a groupToggle —
  // otherwise the rows stay direct children of `.section` so its
  // flex-column gap continues to apply unchanged. When wrapped,
  // `.groupContent` re-applies the same column-gap layout (the
  // single wrapper child would otherwise collapse the gap between
  // its sibling rows). `.groupOff` dims + disables interaction
  // when the group is toggled off; the title row stays
  // interactive so the user can toggle back on without
  // un-collapsing.
  const wrappedContent = groupToggle ? (
    <div
      className={`${styles.groupContent} ${groupOff ? styles.groupOff : ''}`.trim()}
    >
      {children}
    </div>
  ) : (
    children
  );

  if (!collapsible) {
    return (
      <section className={styles.section} data-panel-section={title}>
        {wrapWithTooltip(
          <div className={styles.titleRow}>
            <h3 className={styles.heading}>{title}</h3>
            {duplicateDot}
            {overrideDot}
            {groupToggleButton}
          </div>
        )}
        {wrappedContent}
      </section>
    );
  }

  const handleToggle = (): void => setOpen((v) => !v);
  return (
    <section className={styles.section} data-panel-section={title}>
      {wrapWithTooltip(
        <button
          className={styles.toggle}
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
        >
          <span className={styles.heading}>{title}</span>
          {duplicateDot}
          {overrideDot}
          {groupToggleButton}
          <IconChevronDown
            size={14}
            stroke={2}
            className={`${styles.caret} ${open ? '' : styles.caretCollapsed}`}
            aria-hidden="true"
          />
        </button>
      )}
      {open && wrappedContent}
    </section>
  );
};

type DuplicateIndicatorInfo = {
  header: string;
  label: string;
  ariaLabel: string;
};

type OverrideIndicatorInfo = {
  header: string;
  label: string;
  ariaLabel: string;
  onContextMenu: (e: MouseEvent<HTMLSpanElement>) => void;
};

/**
 * Yellow warning state for a section title — fires when the parser
 * saw any of this section's CSS properties declared more than once
 * in the element's class block. Editing any field in this section
 * (or anywhere on the element) rewrites the class block and clears
 * the duplicate, so the indicator self-heals on the next user
 * interaction.
 *
 * Returns the tooltip data so the section can hoist the hover hit
 * area onto the whole title row rather than just a tiny dot.
 */
const useDuplicateIndicator = (
  elementId: string | undefined,
  cssProperties: ReadonlyArray<string> | undefined
): DuplicateIndicatorInfo | null => {
  const duplicateProps = useCanvasStore((s) =>
    elementId ? s.cssDuplicates[elementId] ?? null : null
  );
  if (!elementId || !cssProperties || cssProperties.length === 0) return null;
  if (!duplicateProps || duplicateProps.length === 0) return null;
  const matched = cssProperties.filter((p) => duplicateProps.includes(p));
  if (matched.length === 0) return null;
  const label = matched
    .map((p) => `- ${p} declared more than once`)
    .join('\n');
  return {
    header: 'Duplicate declarations',
    label,
    ariaLabel: `Duplicate CSS declarations: ${matched.join(', ')}`,
  };
};

/**
 * Override-active state for a section title — fires when any of the
 * section's fields is overridden at the currently-active axis (a
 * non-desktop breakpoint OR a non-default state). Returns tooltip
 * data plus the right-click handler that resets the affected
 * overrides at that axis.
 *
 * Only one axis surfaces at a time — non-default states are disabled
 * at non-desktop breakpoints, so when both could apply we never
 * actually have both active.
 */
const useOverrideIndicator = (
  elementId: string | undefined,
  fields: ReadonlyArray<keyof BreakpointOverride> | undefined
): OverrideIndicatorInfo | null => {
  const overriddenBreakpointFields = useBreakpointOverrideFields(
    elementId ?? ''
  );
  const overriddenStateFields = useStateOverrideFields(elementId ?? '');
  const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
  const activeStateName = useCanvasStore((s) => s.activeStateName);
  const resetBreakpointFields = useCanvasStore(
    (s) => s.resetElementFieldsAtBreakpoint
  );
  const resetStateFields = useCanvasStore(
    (s) => s.resetElementFieldsAtState
  );
  if (!elementId || !fields || fields.length === 0) return null;

  // Pick which axis to surface. Prefer state when one is active —
  // breakpoint indicators are also disabled (state ⇒ desktop) by the
  // switcher's effect, so this branch ordering matches the routing.
  const axis: 'state' | 'breakpoint' | null =
    activeStateName !== null
      ? 'state'
      : activeBreakpointId !== 'desktop'
      ? 'breakpoint'
      : null;
  if (axis === null) return null;

  const overriddenFields =
    axis === 'state' ? overriddenStateFields : overriddenBreakpointFields;
  const overriddenInSection = fields.filter((f) => overriddenFields.has(f));
  if (overriddenInSection.length === 0) return null;

  const label = formatOverrideList(overriddenInSection);

  const handleContextMenu = (e: MouseEvent<HTMLSpanElement>): void => {
    e.preventDefault();
    if (axis === 'state' && activeStateName !== null) {
      resetStateFields(elementId, activeStateName, overriddenInSection);
    } else if (axis === 'breakpoint') {
      resetBreakpointFields(
        elementId,
        activeBreakpointId,
        overriddenInSection
      );
    }
  };

  return {
    header: 'Style Overrides',
    label,
    ariaLabel: `Overridden styles: ${label}`,
    onContextMenu: handleContextMenu,
  };
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

type RowProps = {
  label: string;
  children: ReactNode;
  /**
   * Optional hover tooltip for the whole row — used to explain
   * what a property does when the label alone isn't enough (e.g.
   * `Direction`, `Fill mode`, `Iteration` for animations). Shown
   * when the user hovers anywhere in the row, including over the
   * control, so they don't have to find the small label area.
   */
  tooltip?: string;
};

/** A labeled row inside a Section. Wraps the label and the control(s). */
export const Row = ({ label, children, tooltip }: RowProps): JSX.Element => {
  const row = (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
  // The row's label automatically becomes the tooltip header so
  // call sites only need to write the description text — no need
  // to repeat the label name in every tooltip string.
  return tooltip ? (
    <Tooltip header={label} label={tooltip}>
      {row}
    </Tooltip>
  ) : (
    row
  );
};

type FieldConfig = {
  /** Visible label rendered above the control. */
  label: string;
  /** Hover tooltip body (label is used as the header). */
  tooltip?: string;
  /** The control(s) — usually a single input. */
  children: ReactNode;
};

type DualFieldProps = {
  left: FieldConfig;
  right: FieldConfig;
};

/**
 * Two label-on-top fields side by side. Used by sections that have
 * naturally-paired controls (Duration + Easing, Delay + Iteration,
 * Direction + Fill mode). Each field is wrapped in a Tooltip with its
 * own label as the header so hovering anywhere in that half surfaces
 * the right description.
 */
export const DualField = ({ left, right }: DualFieldProps): JSX.Element => {
  return (
    <div className={styles.dualField}>
      <FieldHalf {...left} />
      <FieldHalf {...right} />
    </div>
  );
};

const FieldHalf = ({ label, tooltip, children }: FieldConfig): JSX.Element => {
  const body = (
    <div className={styles.fieldHalf}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  );
  return tooltip ? (
    <Tooltip header={label} label={tooltip}>
      {body}
    </Tooltip>
  ) : (
    body
  );
};
