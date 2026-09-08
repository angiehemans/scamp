// parsers/transform.ts — the `transform` function list, both directions.
import type { TransformDef } from "../element";
import { requireGroup } from "../safeAccess";
import { tokenizeShorthandSegment } from "./common";

const CALL_RE = /^([a-zA-Z]+)\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/;

/** A `<length-percentage>` a translate axis accepts, kept verbatim. */
const LENGTH_RE =
  /^(?:-?(?:\d+|\d*\.\d+)(?:px|%|r?em|vh|vw|vmin|vmax|ch)|0|var\(--[A-Za-z0-9_-]+\))$/;
const ANGLE_RE = /^(-?(?:\d+|\d*\.\d+))(deg)?$/;
const NUMBER_RE = /^-?(?:\d+|\d*\.\d+)$/;

/** `4.00` → `4`, `1.50` → `1.5`; integers stay integers. */
const compact = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(4)));
};

/** Split a function's argument list on top-level commas. */
const splitArgs = (raw: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      out.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(raw.slice(start).trim());
  return out.filter((a) => a.length > 0);
};

const angle = (raw: string): number | null => {
  const m = raw.trim().match(ANGLE_RE);
  if (!m) return null;
  // A unitless value is only valid CSS for zero.
  if (m[2] === undefined && Number(requireGroup(m, 1)) !== 0) return null;
  const n = Number(requireGroup(m, 1));
  return Number.isFinite(n) ? n : null;
};

const number = (raw: string): number | null => {
  const t = raw.trim();
  if (!NUMBER_RE.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const length = (raw: string): string | null => {
  const t = raw.trim();
  return LENGTH_RE.test(t) ? (t === '0' ? '0px' : t) : null;
};

/**
 * Parse one function call into a `TransformDef`.
 *
 * Accepts the two-axis forms and their axis-specific spellings
 * (`translateX`, `scaleY`, `skewX`, …), each normalised to the two-axis
 * def. Refuses — returns null — for anything else: `matrix(...)`,
 * `translate3d(...)`, `rotate3d(...)`, `perspective(...)`, an angle in
 * `turn`/`rad`, a bad argument count. The caller then keeps the whole
 * declaration verbatim in `customProperties`.
 */
export const parseTransformFunction = (segment: string): TransformDef | null => {
  if (typeof segment !== 'string') return null;
  const m = segment.trim().match(CALL_RE);
  if (!m) return null;
  const name = requireGroup(m, 1).toLowerCase();
  const args = splitArgs(requireGroup(m, 2));

  switch (name) {
    case 'translate': {
      if (args.length < 1 || args.length > 2) return null;
      const x = length(args[0] ?? '');
      const y = args.length === 2 ? length(args[1] ?? '') : '0px';
      return x === null || y === null ? null : { kind: 'translate', x, y };
    }
    case 'translatex': {
      if (args.length !== 1) return null;
      const x = length(args[0] ?? '');
      return x === null ? null : { kind: 'translate', x, y: '0px' };
    }
    case 'translatey': {
      if (args.length !== 1) return null;
      const y = length(args[0] ?? '');
      return y === null ? null : { kind: 'translate', x: '0px', y };
    }
    case 'rotate': {
      if (args.length !== 1) return null;
      const a = angle(args[0] ?? '');
      return a === null ? null : { kind: 'rotate', angle: a };
    }
    case 'scale': {
      if (args.length < 1 || args.length > 2) return null;
      const x = number(args[0] ?? '');
      const y = args.length === 2 ? number(args[1] ?? '') : x;
      return x === null || y === null ? null : { kind: 'scale', x, y };
    }
    case 'scalex': {
      if (args.length !== 1) return null;
      const x = number(args[0] ?? '');
      return x === null ? null : { kind: 'scale', x, y: 1 };
    }
    case 'scaley': {
      if (args.length !== 1) return null;
      const y = number(args[0] ?? '');
      return y === null ? null : { kind: 'scale', x: 1, y };
    }
    case 'skew': {
      if (args.length < 1 || args.length > 2) return null;
      const x = angle(args[0] ?? '');
      const y = args.length === 2 ? angle(args[1] ?? '') : 0;
      return x === null || y === null ? null : { kind: 'skew', x, y };
    }
    case 'skewx': {
      if (args.length !== 1) return null;
      const x = angle(args[0] ?? '');
      return x === null ? null : { kind: 'skew', x, y: 0 };
    }
    case 'skewy': {
      if (args.length !== 1) return null;
      const y = angle(args[0] ?? '');
      return y === null ? null : { kind: 'skew', x: 0, y };
    }
    default:
      return null;
  }
};

/**
 * Parse a full `transform` value. `none` / empty → `[]`. If ANY function
 * refuses, the whole value returns null so the declaration survives
 * verbatim — a partial parse would silently drop part of the author's
 * transform on the next write.
 */
export const parseTransformList = (
  raw: string
): ReadonlyArray<TransformDef> | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return [];
  const tokens = tokenizeShorthandSegment(trimmed);
  if (tokens.length === 0) return null;
  const out: TransformDef[] = [];
  for (const token of tokens) {
    const parsed = parseTransformFunction(token);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
};

const formatOne = (t: TransformDef): string => {
  switch (t.kind) {
    case 'translate':
      return `translate(${t.x}, ${t.y})`;
    case 'rotate':
      return `rotate(${compact(t.angle)}deg)`;
    case 'scale':
      return t.x === t.y ? `scale(${compact(t.x)})` : `scale(${compact(t.x)}, ${compact(t.y)})`;
    case 'skew':
      return `skew(${compact(t.x)}deg, ${compact(t.y)}deg)`;
  }
};

/**
 * Inverse of `parseTransformList`. Empty → empty string; the caller
 * decides between emitting nothing and `transform: none`.
 */
export const formatTransformList = (
  transforms: ReadonlyArray<TransformDef>
): string => transforms.map(formatOne).join(' ');
