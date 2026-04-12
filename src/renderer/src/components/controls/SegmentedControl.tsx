import type { ReactNode } from 'react';
import styles from './Controls.module.css';

type Option<V extends string> = {
  value: V;
  label: ReactNode;
};

type Props<V extends string> = {
  value: V;
  options: ReadonlyArray<Option<V>>;
  onChange: (value: V) => void;
  /** Tooltip shown on hover. */
  title?: string;
};

export const SegmentedControl = <V extends string>({
  value,
  options,
  onChange,
  title,
}: Props<V>): JSX.Element => {
  return (
    <div className={styles.segmented} role="radiogroup" title={title}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
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
      })}
    </div>
  );
};
