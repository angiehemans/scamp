import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';

type Option<V extends string> = {
  value: V;
  label: ReactNode;
  /** Optional per-option tooltip. When set, the button is wrapped in
   * Tooltip so each segment can describe its effect individually. */
  tooltip?: string;
  /** Optional aria-label override — required when `label` is a
   * non-text ReactNode (icon-only buttons) so the button has an
   * accessible name. Falls back to `tooltip` when omitted, or the
   * string value of `label` if it happens to be a plain string. */
  ariaLabel?: string;
};

type Props<V extends string> = {
  value: V;
  options: ReadonlyArray<Option<V>>;
  onChange: (value: V) => void;
  /** Tooltip shown on hover of the whole group. Mutually useful with
   * per-option tooltips — the group-level tooltip describes the axis,
   * per-option tooltips describe each segment. */
  title?: string;
};

export const SegmentedControl = <V extends string>({
  value,
  options,
  onChange,
  title,
}: Props<V>): JSX.Element => {
  const group = (
    <div className={styles.segmented} role="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        const accessibleName =
          opt.ariaLabel ??
          opt.tooltip ??
          (typeof opt.label === 'string' ? opt.label : undefined);
        const button = (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={active}
            aria-label={accessibleName}
            className={`${styles.segmentedButton} ${active ? styles.segmentedButtonActive : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
        return opt.tooltip ? (
          <Tooltip key={opt.value} label={opt.tooltip}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
  return title ? <Tooltip label={title}>{group}</Tooltip> : group;
};
