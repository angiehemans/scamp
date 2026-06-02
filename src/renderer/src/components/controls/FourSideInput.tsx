import { PrefixSuffixInput } from './PrefixSuffixInput';
import {
  formatSpaceShorthand,
  formatSpaceValue,
  spaceTupleEquals,
  spaceValueEquals,
  type SpaceTuple,
  type SpaceValue,
} from '@lib/spaceValue';

type Props = {
  value: SpaceTuple;
  onChange: (next: SpaceTuple) => void;
  /** Minimum allowed per-side numeric value (inclusive). Tokens
   *  bypass this — they're emitted verbatim. */
  min?: number;
  /** Inline prefix label shown inside the input (e.g. "P", "M"). */
  prefix?: string;
  /** Tooltip shown on hover. */
  title?: string;
};

/**
 * Tokenise a shorthand string, respecting parens so values like
 * `var(--a, 16px) 8` split into two tokens rather than four.
 */
const tokenize = (raw: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of raw) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/[\s,]/.test(ch) && depth === 0) {
      if (current.length > 0) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
};

const VAR_RE = /^var\(\s*--[A-Za-z_][\w-]*(?:\s*,[^)]*)?\)$/;

const parseToken = (raw: string, min: number): SpaceValue | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (VAR_RE.test(trimmed)) {
    return { kind: 'token', ref: trimmed };
  }
  // Strip a trailing "px" if present, otherwise treat as a bare number.
  const numeric = trimmed.replace(/px$/i, '');
  const n = Number(numeric);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.round(n));
};

/**
 * Parse a CSS-style shorthand into a `SpaceTuple`. Accepts 1, 2, 3,
 * or 4 tokens. Each token may be a plain number (clamped to `min`),
 * an `Npx` value, or a `var(--name)` reference. Mixed forms are
 * allowed (`16 var(--space-md)`). Returns `null` for any unparseable
 * input so callers can revert on blur.
 */
const parseShorthand = (
  raw: string,
  min: number
): SpaceTuple | null => {
  const tokens = tokenize(raw.trim());
  if (tokens.length === 0 || tokens.length > 4) return null;

  const values: SpaceValue[] = [];
  for (const t of tokens) {
    const v = parseToken(t, min);
    if (v === null) return null;
    values.push(v);
  }

  if (values.length === 1) {
    const [a] = values as [SpaceValue];
    return [a, a, a, a];
  }
  if (values.length === 2) {
    const [a, b] = values as [SpaceValue, SpaceValue];
    return [a, b, a, b];
  }
  if (values.length === 3) {
    const [a, b, c] = values as [SpaceValue, SpaceValue, SpaceValue];
    return [a, b, c, b];
  }
  const [a, b, c, d] = values as [SpaceValue, SpaceValue, SpaceValue, SpaceValue];
  return [a, b, c, d];
};

/** Increment a single side. Tokens stay tokens — arrows are a numeric
 *  affordance, not a token-replace gesture. */
const bumpSide = (v: SpaceValue, delta: number, min: number): SpaceValue => {
  if (typeof v !== 'number') return v;
  return Math.max(min, v + delta);
};

/**
 * A single text input for editing a [top, right, bottom, left] tuple using
 * CSS shorthand notation. Accepts 1–4 values separated by spaces or
 * commas. Each value can be a plain number, `Npx`, or a `var(--name)`
 * reference. Numbers and tokens can be mixed across sides.
 *
 * Invalid input reverts on blur via the PrefixSuffixInput value sync.
 */
export const FourSideInput = ({
  value,
  onChange,
  min = 0,
  prefix,
  title,
}: Props): JSX.Element => {
  const handleCommit = (draft: string): void => {
    const parsed = parseShorthand(draft, min);
    if (!parsed) return;
    if (!spaceTupleEquals(parsed, value)) onChange(parsed);
  };

  const handleArrow = (draft: string, direction: 1 | -1, shift: boolean): void => {
    const delta = (shift ? 10 : 1) * direction;
    const base = parseShorthand(draft, min) ?? value;
    const next: SpaceTuple = [
      bumpSide(base[0], delta, min),
      bumpSide(base[1], delta, min),
      bumpSide(base[2], delta, min),
      bumpSide(base[3], delta, min),
    ];
    if (!spaceTupleEquals(next, value)) onChange(next);
  };

  const allEqual =
    spaceValueEquals(value[0], value[1]) &&
    spaceValueEquals(value[1], value[2]) &&
    spaceValueEquals(value[2], value[3]);
  const tooltip =
    title ??
    (!allEqual
      ? `T:${formatSpaceValue(value[0])} R:${formatSpaceValue(value[1])} B:${formatSpaceValue(value[2])} L:${formatSpaceValue(value[3])}`
      : undefined);

  return (
    <PrefixSuffixInput
      value={formatSpaceShorthand(value)}
      onCommit={handleCommit}
      onArrow={handleArrow}
      prefix={prefix}
      placeholder="0"
      title={tooltip}
    />
  );
};
