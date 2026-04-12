import { useEffect, useState } from 'react';
import styles from './Controls.module.css';

type FourSideValue = [number, number, number, number];

type Props = {
  value: FourSideValue;
  onChange: (next: FourSideValue) => void;
  /** Minimum allowed per-side value (inclusive). */
  min?: number;
  /** Inline prefix label shown inside the input (e.g. "P", "M", "W"). */
  prefix?: string;
  /** Tooltip shown on hover. */
  title?: string;
};

/**
 * Parse a CSS-style shorthand string into a [top, right, bottom, left] tuple.
 * Accepts 1, 2, 3, or 4 values separated by spaces or commas.
 * Returns null if the input is invalid.
 */
const parseShorthand = (
  raw: string,
  min: number
): FourSideValue | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const tokens = trimmed.split(/[\s,]+/).filter((t) => t.length > 0);
  if (tokens.length === 0 || tokens.length > 4) return null;

  const nums: number[] = [];
  for (const token of tokens) {
    const n = Number(token);
    if (!Number.isFinite(n)) return null;
    nums.push(Math.max(min, Math.round(n)));
  }

  if (nums.length === 1) {
    const [a] = nums as [number];
    return [a, a, a, a];
  }
  if (nums.length === 2) {
    const [a, b] = nums as [number, number];
    return [a, b, a, b];
  }
  if (nums.length === 3) {
    const [a, b, c] = nums as [number, number, number];
    return [a, b, c, b];
  }
  const [a, b, c, d] = nums as [number, number, number, number];
  return [a, b, c, d];
};

/** Format a tuple as a shorthand string, collapsing when sides match. */
const toShorthand = (v: FourSideValue): string => {
  const [t, r, b, l] = v;
  if (t === r && r === b && b === l) return String(t);
  if (t === b && r === l) return `${t} ${r}`;
  return `${t} ${r} ${b} ${l}`;
};

/**
 * A single text input for editing a [top, right, bottom, left] tuple using
 * CSS shorthand notation. Accepts 1–4 values separated by spaces or commas.
 *
 * Shows a preview of the resolved individual sides below the input when the
 * sides differ. Invalid input reverts on blur.
 */
export const FourSideInput = ({ value, onChange, min = 0, prefix, title }: Props): JSX.Element => {
  const [draft, setDraft] = useState(toShorthand(value));

  useEffect(() => {
    setDraft(toShorthand(value));
  }, [value]);

  const commit = (): void => {
    const parsed = parseShorthand(draft, min);
    if (!parsed) {
      // Invalid — revert to current value.
      setDraft(toShorthand(value));
      return;
    }
    const changed =
      parsed[0] !== value[0] ||
      parsed[1] !== value[1] ||
      parsed[2] !== value[2] ||
      parsed[3] !== value[3];
    if (changed) onChange(parsed);
    setDraft(toShorthand(parsed));
  };

  const allEqual = value[0] === value[1] && value[1] === value[2] && value[2] === value[3];

  return (
    <div
      className={styles.colorInputRow}
      title={title ?? (!allEqual ? `T:${value[0]} R:${value[1]} B:${value[2]} L:${value[3]}` : undefined)}
    >
      {prefix && <span className={styles.inputPrefix}>{prefix}</span>}
      <input
        type="text"
        className={styles.colorText}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder="0"
      />
    </div>
  );
};
