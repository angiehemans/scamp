import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';

type Option<V extends string> = {
  value: V;
  label: string;
  /**
   * When true the option renders greyed and unselectable. The currently
   * selected value still displays even if disabled (native `<select>`
   * shows the matching option regardless), so callers can disable a mode
   * without breaking an element that already uses it.
   */
  disabled?: boolean;
};

type Props<V extends string> = {
  value: V;
  options: ReadonlyArray<Option<V>>;
  onChange: (value: V) => void;
  /** Tooltip shown on hover. */
  title?: string;
};

export const EnumSelect = <V extends string>({
  value,
  options,
  onChange,
  title,
}: Props<V>): JSX.Element => {
  const select = (
    <select
      className={styles.select}
      value={value}
      onChange={(e) => onChange(e.target.value as V)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
  return title ? <Tooltip label={title}>{select}</Tooltip> : select;
};
