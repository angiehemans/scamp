import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';

type Option<V extends string> = {
  value: V;
  label: string;
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
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
  return title ? <Tooltip label={title}>{select}</Tooltip> : select;
};
