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
 * A typed `<select>` styled to match the dark theme. The generic parameter
 * lets callers narrow `onChange` to their specific value union (e.g.
 * `BorderStyle`, `AlignItems`).
 */
export const EnumSelect = <V extends string>({
  value,
  options,
  onChange,
}: Props<V>): JSX.Element => {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
