import styles from './Controls.module.css';

type Option<V extends string> = {
  value: V;
  label: string;
};

type Props<V extends string> = {
  value: V;
  options: ReadonlyArray<Option<V>>;
  onChange: (value: V) => void;
};

/**
 * A horizontal segmented button group. Use for short, mutually-exclusive
 * choices (2–4 options) where the labels can fit inline; for longer lists
 * prefer `EnumSelect`.
 */
export const SegmentedControl = <V extends string>({
  value,
  options,
  onChange,
}: Props<V>): JSX.Element => {
  return (
    <div className={styles.segmented} role="radiogroup">
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
