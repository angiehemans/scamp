import { useEffect, useState } from 'react';
import styles from './Controls.module.css';

type Props = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Minimum allowed value (inclusive). Values below revert on blur. */
  min?: number;
  /** Maximum allowed value (inclusive). Values above revert on blur. */
  max?: number;
  /** Placeholder shown when value is undefined. */
  placeholder?: string;
  /** When true, blanking the input writes `undefined` instead of reverting. */
  allowEmpty?: boolean;
  /** Inline prefix label shown inside the input (e.g. "W", "H", "X"). */
  prefix?: string;
  /** Tooltip shown on hover. */
  title?: string;
};

/**
 * A small px / number input. Tracks a local draft so the user can type
 * intermediate values (`-`, partial numbers, etc.) without each keystroke
 * being committed. The committed value is clamped and re-formatted on blur;
 * invalid input reverts to the previous value.
 */
export const NumberInput = ({
  value,
  onChange,
  min,
  max,
  placeholder,
  allowEmpty = false,
  prefix,
  title,
}: Props): JSX.Element => {
  const [draft, setDraft] = useState<string>(value === undefined ? '' : String(value));

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
  }, [value]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      if (allowEmpty) {
        if (value !== undefined) onChange(undefined);
        return;
      }
      // No value allowed — revert to previous.
      setDraft(value === undefined ? '' : String(value));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(value === undefined ? '' : String(value));
      return;
    }
    let next = parsed;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    if (next !== value) onChange(next);
    setDraft(String(next));
  };

  if (prefix) {
    return (
      <div className={styles.colorInputRow} title={title}>
        <span className={styles.inputPrefix}>{prefix}</span>
        <input
          type="text"
          inputMode="numeric"
          className={styles.colorText}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`${styles.input} ${styles.numberInput}`}
      value={draft}
      placeholder={placeholder}
      title={title}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
};
