import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';

type Option<V extends string> = {
  value: V;
  label: ReactNode;
  /** Optional per-option tooltip. When set, the button is wrapped in
   * Tooltip so each segment can describe its effect individually. */
  tooltip?: string;
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
        const button = (
          <button
            type="button"
            key={opt.value}
            role="radio"
            aria-checked={active}
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
