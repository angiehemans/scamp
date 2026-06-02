import { DEFAULT_RECT_STYLES } from './defaults';
import { isPresetName } from './animationPresets';
import { FILTER_UNITS, isFilterKind } from './filterKinds';
import type {
  AnimationDirection,
  AnimationFillMode,
  AnimationPlayState,
  BorderStyle,
  BoxShadowDef,
  ElementAnimation,
  FilterDef,
  FilterKind,
  HeightMode,
  TransitionDef,
  WidthMode,
} from './element';
import { tokenSpaceValue, type SpaceTuple, type SpaceValue } from './spaceValue';

/**
 * Parse a `123px` (or bare number) into an integer. Returns 0 for empty
 * or unparseable input — keeps callers from having to special-case missing
 * values themselves.
 */
export const parsePx = (raw: string): number => {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
  if (!match || match[1] === undefined) return 0;
  return Math.round(Number(match[1]));
};

const VALID_BORDER_STYLES: ReadonlySet<string> = new Set([
  'none',
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
]);

const isBorderStyle = (token: string): token is BorderStyle =>
  token === 'none' || token === 'solid' || token === 'dashed' || token === 'dotted';

export type ParsedBorder = {
  borderWidth: number;
  borderStyle: BorderStyle;
  borderColor: string;
};

/**
 * Parse a CSS `border` shorthand into the three scamp fields.
 *
 * Tokenization is space-separated, with one wrinkle: rgb()/rgba() and similar
 * function-call colors contain spaces inside parens that are NOT separators.
 * We collapse anything inside `()` first.
 *
 * Empty input returns the documented defaults so the parser can use this
 * as a single source of truth without needing to track absence separately.
 */
export const parseBorderShorthand = (raw: string): ParsedBorder => {
  const fallback: ParsedBorder = {
    borderWidth: 0,
    borderStyle: DEFAULT_RECT_STYLES.borderStyle,
    borderColor: DEFAULT_RECT_STYLES.borderColor,
  };
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;

  const tokens = tokenizeBorder(trimmed);
  if (tokens.length === 0) return fallback;

  // `border: none` (or `0`) — no border at all.
  if (tokens.length === 1) {
    const only = tokens[0]!;
    if (only === 'none' || only === '0' || only === '0px') {
      return { borderWidth: 0, borderStyle: 'none', borderColor: fallback.borderColor };
    }
  }

  let width: number | null = null;
  let style: BorderStyle | null = null;
  let color: string | null = null;

  for (const token of tokens) {
    if (width === null && /^-?\d+(?:\.\d+)?(?:px)?$/.test(token)) {
      width = parsePx(token);
      continue;
    }
    if (style === null && VALID_BORDER_STYLES.has(token)) {
      // Anything outside the supported subset collapses to `solid` so the
      // canvas still draws something visible. Round-trip preserves the
      // original via customProperties when used at the top level.
      style = isBorderStyle(token) ? token : 'solid';
      continue;
    }
    if (color === null) {
      color = token;
    }
  }

  return {
    borderWidth: width ?? fallback.borderWidth,
    borderStyle: style ?? fallback.borderStyle,
    borderColor: color ?? fallback.borderColor,
  };
};

const tokenizeBorder = (input: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (current.length > 0) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
};

/**
 * Parse a CSS `padding` shorthand into [top, right, bottom, left] in px.
 *
 * Supports the standard 1-, 2-, 3-, and 4-value forms.
 */
export const parsePaddingShorthand = (
  raw: string
): [number, number, number, number] => {
  if (typeof raw !== 'string') return [0, 0, 0, 0];
  const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [0, 0, 0, 0];

  const v = tokens.map(parsePx);

  if (v.length === 1) {
    const [a] = v as [number];
    return [a, a, a, a];
  }
  if (v.length === 2) {
    const [a, b] = v as [number, number];
    return [a, b, a, b];
  }
  if (v.length === 3) {
    const [a, b, c] = v as [number, number, number];
    return [a, b, c, b];
  }
  const [a, b, c, d] = v as [number, number, number, number];
  return [a, b, c, d];
};

/**
 * Parse a CSS `border-radius` shorthand into [TL, TR, BR, BL] in px.
 *
 * CSS border-radius shorthand order:
 *   1 value  → all four corners
 *   2 values → (top-left + bottom-right) (top-right + bottom-left)
 *   3 values → top-left (top-right + bottom-left) bottom-right
 *   4 values → top-left top-right bottom-right bottom-left
 *
 * Only the radius part before any `/` is parsed — the vertical radius
 * (elliptical corners) is ignored for POC.
 */
export const parseBorderRadiusShorthand = (
  raw: string
): [number, number, number, number] => {
  if (typeof raw !== 'string') return [0, 0, 0, 0];
  // Strip everything after `/` (vertical radius for elliptical corners).
  const horizontal = raw.split('/')[0] ?? '';
  const tokens = horizontal.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [0, 0, 0, 0];

  const v = tokens.map(parsePx);

  if (v.length === 1) {
    const [a] = v as [number];
    return [a, a, a, a];
  }
  if (v.length === 2) {
    const [a, b] = v as [number, number];
    return [a, b, a, b];
  }
  if (v.length === 3) {
    const [a, b, c] = v as [number, number, number];
    return [a, b, c, b];
  }
  const [a, b, c, d] = v as [number, number, number, number];
  return [a, b, c, d];
};

// ---- Transitions ---------------------------------------------------

const NAMED_EASINGS: ReadonlySet<string> = new Set([
  'ease',
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
]);

const TIME_RE = /^(-?\d+(?:\.\d+)?)(ms|s)$/i;

const parseTimeMs = (token: string): number | null => {
  const m = token.match(TIME_RE);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2].toLowerCase() === 's' ? Math.round(n * 1000) : Math.round(n);
};

/**
 * Split a CSS value-list on top-level commas, respecting parens. Used
 * to break a `transition` shorthand like
 *   `opacity 200ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1)`
 * into per-transition segments without splitting inside cubic-bezier.
 */
export const splitCssList = (raw: string): string[] => {
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
  const tail = raw.slice(start).trim();
  if (tail.length > 0) out.push(tail);
  return out;
};

/**
 * Split a single CSS shorthand segment into space-separated tokens
 * with parens kept intact. A `cubic-bezier(0.4, 0, 0.2, 1)` or an
 * `rgba(0, 0, 0, 0.15)` is one token even though it contains spaces
 * and commas. Used by the transition and box-shadow parsers.
 */
export const tokenizeShorthandSegment = (raw: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /\s/.test(ch as string)) {
      const tok = raw.slice(start, i).trim();
      if (tok.length > 0) out.push(tok);
      start = i + 1;
    }
  }
  const tail = raw.slice(start).trim();
  if (tail.length > 0) out.push(tail);
  return out;
};

const isEasingToken = (token: string): boolean => {
  if (NAMED_EASINGS.has(token.toLowerCase())) return true;
  if (/^cubic-bezier\(/i.test(token)) return true;
  if (/^steps\(/i.test(token)) return true;
  return false;
};

/**
 * Parse a single transition segment (`opacity 200ms ease 100ms`) into
 * a TransitionDef. Per the CSS spec, the first `<time>` token is the
 * duration and the second is the delay; any keyword in the easing set
 * (or `cubic-bezier(...)` / `steps(...)`) is the easing; the leftover
 * non-time / non-easing token is the property name.
 */
export const parseTransitionSegment = (segment: string): TransitionDef | null => {
  const tokens = tokenizeShorthandSegment(segment);
  if (tokens.length === 0) return null;

  let durationMs: number | null = null;
  let delayMs: number | null = null;
  let easing: string | null = null;
  let property: string | null = null;

  for (const token of tokens) {
    const time = parseTimeMs(token);
    if (time !== null) {
      if (durationMs === null) durationMs = time;
      else if (delayMs === null) delayMs = time;
      // Extra time tokens are spec violations — ignore.
      continue;
    }
    if (easing === null && isEasingToken(token)) {
      easing =
        /^cubic-bezier\(/i.test(token) || /^steps\(/i.test(token)
          ? token
          : token.toLowerCase();
      continue;
    }
    if (property === null) {
      property = token;
      continue;
    }
  }

  return {
    property: property ?? 'all',
    durationMs: durationMs ?? 0,
    easing: easing ?? 'ease',
    delayMs: delayMs ?? 0,
  };
};

/**
 * Parse a `transition` shorthand value into an ordered list of
 * `TransitionDef`s. Input may be a single transition or a
 * comma-separated list. Empty input (or `none`) returns an empty
 * list. Malformed segments are skipped rather than failing the whole
 * parse so an agent edit that includes one bad segment doesn't drop
 * the others.
 */
export const parseTransitionShorthand = (
  raw: string
): ReadonlyArray<TransitionDef> => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === 'none') return [];
  const segments = splitCssList(trimmed);
  const result: TransitionDef[] = [];
  for (const segment of segments) {
    const parsed = parseTransitionSegment(segment);
    if (parsed) result.push(parsed);
  }
  return result;
};

/**
 * Format a duration / delay number into the most readable CSS
 * representation. Whole-second values come back as `1s`; everything
 * else stays in `ms`.
 */
export const formatTransitionTime = (ms: number): string => {
  if (ms === 0) return '0ms';
  if (ms % 1000 === 0) return `${ms / 1000}s`;
  return `${ms}ms`;
};

/**
 * Inverse of `parseTransitionShorthand`. Empty list → empty string;
 * the caller decides whether to emit nothing or `transition: none`.
 */
export const formatTransitionShorthand = (
  transitions: ReadonlyArray<TransitionDef>
): string => {
  if (transitions.length === 0) return '';
  return transitions
    .map((t) => {
      const parts: string[] = [
        t.property,
        formatTransitionTime(t.durationMs),
        t.easing,
      ];
      if (t.delayMs !== 0) parts.push(formatTransitionTime(t.delayMs));
      return parts.join(' ');
    })
    .join(', ');
};

// ---- Refusable variants ---------------------------------------------
//
// The classic `parsePx` / `parsePaddingShorthand` / `parseBorderRadiusShorthand`
// helpers return 0 / [0,0,0,0] for any input they can't interpret, which
// is convenient for typed canvas state but lossy when an agent has
// written something Scamp doesn't model — `padding: 50%`,
// `border-radius: 1.5em`, `padding: 16px auto`, etc.
//
// These refusable variants return `null` instead so the cssPropertyMap
// can detect "Scamp can't reduce this to typed fields" and fall through
// to `customProperties` with the raw declaration intact. The original
// helpers stay put for callers that need a non-null number.
//
// `var(--token)` references ARE accepted — they round-trip through
// the typed shape as `{ kind: 'token', ref: 'var(--name)' }` rather
// than falling to customProperties. See `spaceValue.ts`.

/**
 * Like `parsePx` but returns `null` for non-px tokens (so callers can
 * preserve `%`, `rem`, `em`, `auto`, etc. by falling through to
 * customProperties). Plain numbers (no unit), bare zero, and `Npx`
 * all parse to a number.
 */
export const parsePxOrNull = (raw: string): number | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
  if (!match || match[1] === undefined) return null;
  return Math.round(Number(match[1]));
};

/**
 * Match a `var(--name)` or `var(--name, fallback)` reference. Returns
 * the full source string (including the `var(` wrapper and any
 * fallback) so the generator can round-trip it byte-for-byte. Anything
 * else returns `null`.
 *
 * We accept fallbacks because they're valid CSS and agents do write
 * them occasionally. The fallback is preserved verbatim — Scamp
 * doesn't try to resolve or split it.
 */
const VAR_TOKEN_RE = /^var\(\s*--[A-Za-z_][\w-]*(?:\s*,[^)]*)?\)$/;

export const parseVarTokenOrNull = (raw: string): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!VAR_TOKEN_RE.test(trimmed)) return null;
  return trimmed;
};

/**
 * Parse a single spacing token — either px (returns `number`) or
 * `var(--name)` (returns the token discriminated form). Anything
 * else returns `null` so the caller can refuse the whole shorthand.
 */
export const parseSpaceValueOrNull = (raw: string): SpaceValue | null => {
  const px = parsePxOrNull(raw);
  if (px !== null) return px;
  const ref = parseVarTokenOrNull(raw);
  if (ref !== null) return tokenSpaceValue(ref);
  return null;
};

/**
 * Refusable variant of `parsePaddingShorthand` that returns a
 * `SpaceTuple` (each side is px or `var()`). Returns `null` if any
 * token isn't accepted by `parseSpaceValueOrNull` — keeping declarations
 * with `%`, `rem`, `auto`, etc. flowing into customProperties.
 *
 * Tokens are split on whitespace OUTSIDE parens so values like
 * `var(--a, 16px) var(--b)` parse correctly without splitting the
 * fallback's internal comma-space.
 */
export const parsePaddingShorthandOrNull = (
  raw: string
): SpaceTuple | null => {
  if (typeof raw !== 'string') return null;
  const tokens = tokenizeBorder(raw.trim());
  if (tokens.length === 0) return null;
  const v: SpaceValue[] = [];
  for (const tok of tokens) {
    const s = parseSpaceValueOrNull(tok);
    if (s === null) return null;
    v.push(s);
  }
  if (v.length === 1) {
    const [a] = v as [SpaceValue];
    return [a, a, a, a];
  }
  if (v.length === 2) {
    const [a, b] = v as [SpaceValue, SpaceValue];
    return [a, b, a, b];
  }
  if (v.length === 3) {
    const [a, b, c] = v as [SpaceValue, SpaceValue, SpaceValue];
    return [a, b, c, b];
  }
  if (v.length === 4) {
    const [a, b, c, d] = v as [SpaceValue, SpaceValue, SpaceValue, SpaceValue];
    return [a, b, c, d];
  }
  return null;
};

/**
 * Refusable variant of `parseBorderRadiusShorthand`. 1-4 px or var()
 * tokens are accepted; anything else (`50%`, `1.5em`, the elliptical
 * slash form) returns null so the raw declaration round-trips via
 * customProperties.
 */
export const parseBorderRadiusShorthandOrNull = (
  raw: string
): SpaceTuple | null => {
  if (typeof raw !== 'string') return null;
  // Reject elliptical-corner shorthand entirely so the slash form
  // round-trips verbatim instead of being silently truncated.
  if (raw.includes('/')) return null;
  return parsePaddingShorthandOrNull(raw);
};

// ---- Animations ----------------------------------------------------

const ANIMATION_DIRECTIONS: ReadonlySet<AnimationDirection> = new Set([
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
]);

const ANIMATION_FILL_MODES: ReadonlySet<AnimationFillMode> = new Set([
  'none',
  'forwards',
  'backwards',
  'both',
]);

const ANIMATION_PLAY_STATES: ReadonlySet<AnimationPlayState> = new Set([
  'running',
  'paused',
]);

/**
 * Reserved CSS keywords the animation shorthand uses for typed
 * fields. The custom-ident NAME of an animation can't collide with
 * any of these (CSS spec rule), so we use them to disambiguate
 * which token is the name on parse.
 */
const ANIMATION_RESERVED_KEYWORDS = new Set<string>([
  'none', // also a fill-mode value
  'infinite',
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
  'forwards',
  'backwards',
  'both',
  'running',
  'paused',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
  ...['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'],
]);

const isAnimationDirection = (token: string): token is AnimationDirection =>
  ANIMATION_DIRECTIONS.has(token as AnimationDirection);

const isAnimationFillMode = (token: string): token is AnimationFillMode =>
  ANIMATION_FILL_MODES.has(token as AnimationFillMode);

const isAnimationPlayState = (token: string): token is AnimationPlayState =>
  ANIMATION_PLAY_STATES.has(token as AnimationPlayState);

/**
 * Reuse the transition-segment tokenizer — same shape: space-
 * separated tokens, paren groups (cubic-bezier, steps) kept intact.
 * Re-exposed via a thin wrapper so the symbol stays internal.
 */
const tokenizeAnimationSegment = (raw: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /\s/.test(ch as string)) {
      const tok = raw.slice(start, i).trim();
      if (tok.length > 0) out.push(tok);
      start = i + 1;
    }
  }
  const tail = raw.slice(start).trim();
  if (tail.length > 0) out.push(tail);
  return out;
};

/**
 * Parse an `<animation-iteration-count>` token: either `infinite` or
 * a finite number. Returns null when the token isn't a valid count.
 */
const parseIterationCount = (token: string): number | 'infinite' | null => {
  const lower = token.toLowerCase();
  if (lower === 'infinite') return 'infinite';
  if (!/^-?\d+(?:\.\d+)?$/.test(token)) return null;
  const n = Number(token);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

/**
 * Parse a single CSS `animation` shorthand value (one animation, no
 * commas) into an `ElementAnimation`. Returns null when no name can
 * be found (the picker can't represent a nameless animation; the
 * caller falls back to `customProperties`).
 *
 * Per the CSS spec, the first `<time>` is duration and the second
 * is delay; iteration is `<number> | infinite`; direction / fill
 * mode / play state are mutually disjoint enum sets so positional
 * disambiguation works. The leftover non-keyword token is the
 * custom-ident name.
 */
export const parseAnimationShorthand = (
  raw: string
): ElementAnimation | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return null;
  // Reject multi-animation source (comma at top level) — caller
  // routes the whole declaration to customProperties verbatim.
  if (splitCssList(trimmed).length > 1) return null;

  const tokens = tokenizeAnimationSegment(trimmed);
  if (tokens.length === 0) return null;

  let durationMs: number | null = null;
  let delayMs: number | null = null;
  let easing: string | null = null;
  let iterationCount: number | 'infinite' | null = null;
  let direction: AnimationDirection | null = null;
  let fillMode: AnimationFillMode | null = null;
  let playState: AnimationPlayState | null = null;
  let name: string | null = null;

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // Times — duration first, delay second (positional per spec).
    const time = parseTimeMs(token);
    if (time !== null) {
      if (durationMs === null) durationMs = time;
      else if (delayMs === null) delayMs = time;
      continue;
    }

    if (easing === null && isEasingToken(token)) {
      easing =
        /^cubic-bezier\(/i.test(token) || /^steps\(/i.test(token)
          ? token
          : lower;
      continue;
    }

    const iteration = parseIterationCount(token);
    if (iteration !== null && iterationCount === null) {
      iterationCount = iteration;
      continue;
    }

    if (direction === null && isAnimationDirection(lower)) {
      direction = lower;
      continue;
    }
    if (fillMode === null && isAnimationFillMode(lower)) {
      fillMode = lower;
      continue;
    }
    if (playState === null && isAnimationPlayState(lower)) {
      playState = lower;
      continue;
    }

    // Anything left that isn't a reserved keyword is the name.
    if (name === null && !ANIMATION_RESERVED_KEYWORDS.has(lower)) {
      name = token;
    }
    // Extra unrecognised tokens are ignored — preserves the parse on
    // odd input rather than failing the whole shorthand.
  }

  if (name === null) return null;

  return {
    name,
    isPreset: isPresetName(name),
    durationMs: durationMs ?? 0,
    easing: easing ?? 'ease',
    delayMs: delayMs ?? 0,
    iterationCount: iterationCount ?? 1,
    direction: direction ?? 'normal',
    fillMode: fillMode ?? 'none',
    playState: playState ?? 'running',
  };
};

/**
 * Format an `ElementAnimation` back into the CSS shorthand.
 *
 * Order: name duration easing delay iteration direction fill-mode
 * play-state. Default values are omitted — but only safely from the
 * tail, since position matters for time tokens (delay is the second
 * time, which means duration must precede it). Easing is positional
 * relative to delay too — emit easing whenever delay is non-default.
 */
export const formatAnimationShorthand = (
  animation: ElementAnimation
): string => {
  // Always emit name + duration + easing (matches the
  // `formatTransitionShorthand` convention — easing is the third
  // positional field and authors expect to see it for grokability).
  // The trailing keyword fields (iteration / direction / fill-mode /
  // play-state) are mutually disjoint enum sets, so the spec accepts
  // any subset in any order — only emit non-defaults.
  const parts: string[] = [
    animation.name,
    formatTransitionTime(animation.durationMs),
    animation.easing,
  ];
  if (animation.delayMs !== 0) {
    parts.push(formatTransitionTime(animation.delayMs));
  }
  if (animation.iterationCount !== 1) {
    parts.push(
      animation.iterationCount === 'infinite'
        ? 'infinite'
        : String(animation.iterationCount)
    );
  }
  if (animation.direction !== 'normal') parts.push(animation.direction);
  if (animation.fillMode !== 'none') parts.push(animation.fillMode);
  if (animation.playState !== 'running') parts.push(animation.playState);
  return parts.join(' ');
};

// ---- Box shadow ------------------------------------------------------

const PX_LENGTH_RE = /^-?\d+(?:\.\d+)?(?:px)?$/;

const isInsetKeyword = (token: string): boolean =>
  token.toLowerCase() === 'inset';

/**
 * Parse a single box-shadow segment into a `BoxShadowDef`.
 *
 * Per the CSS spec, a segment is:
 *   `[ inset? && <length>{2,4} && <color>? ]`
 *
 * - 2 lengths: offsetX, offsetY (blur and spread default to 0)
 * - 3 lengths: offsetX, offsetY, blur (spread defaults to 0)
 * - 4 lengths: offsetX, offsetY, blur, spread
 * - `inset` may appear anywhere in the segment
 * - color is optional (defaults to `currentColor`); may appear before
 *   or after the lengths
 *
 * Returns `null` for inputs we can't reduce: missing offsets, a length
 * expressed as `calc(...)` or a token, more than one non-length /
 * non-`inset` token, etc. Callers (the cssPropertyMap mapper) treat
 * null as "preserve verbatim in customProperties".
 */
export const parseBoxShadowSegment = (segment: string): BoxShadowDef | null => {
  const tokens = tokenizeShorthandSegment(segment);
  if (tokens.length === 0) return null;

  let inset = false;
  const remaining: string[] = [];
  for (const token of tokens) {
    if (isInsetKeyword(token)) {
      // Two `inset` tokens in one segment is malformed — bail.
      if (inset) return null;
      inset = true;
      continue;
    }
    remaining.push(token);
  }

  if (remaining.length === 0) return null;

  // Per spec the color may sit at the start OR the end of the segment,
  // but never in the middle of the lengths. Detect which end (if any)
  // holds the color, then require the remaining slice to be all px
  // lengths. A `calc(...)` length, `var(--space-4)`, or a percent
  // therefore refuses cleanly: it's neither at an end nor a px length,
  // so the parse fails and the value falls back to customProperties.
  const firstIsLength = PX_LENGTH_RE.test(remaining[0]!);
  const lastIsLength = PX_LENGTH_RE.test(remaining[remaining.length - 1]!);

  let color: string | null = null;
  let lengthSlice: string[];
  if (firstIsLength && lastIsLength) {
    lengthSlice = remaining;
  } else if (!firstIsLength && lastIsLength) {
    color = remaining[0]!;
    lengthSlice = remaining.slice(1);
  } else if (firstIsLength && !lastIsLength) {
    color = remaining[remaining.length - 1]!;
    lengthSlice = remaining.slice(0, remaining.length - 1);
  } else {
    // Both ends are non-length: either zero lengths, two colors, or a
    // refusable expression like `var(--shadow-md)` / `inherit`.
    return null;
  }

  const lengths: number[] = [];
  for (const token of lengthSlice) {
    if (!PX_LENGTH_RE.test(token)) return null;
    const n = parsePxOrNull(token);
    if (n === null) return null;
    lengths.push(n);
  }

  if (lengths.length < 2 || lengths.length > 4) return null;

  const offsetX = lengths[0]!;
  const offsetY = lengths[1]!;
  const blur = lengths[2] ?? 0;
  const spread = lengths[3] ?? 0;

  return {
    offsetX,
    offsetY,
    blur,
    spread,
    color: color ?? 'currentColor',
    inset,
  };
};

/**
 * Parse a `box-shadow` shorthand value (single or comma-separated
 * list) into an ordered list of `BoxShadowDef`s. `none`, an empty
 * string, or whitespace returns []. If ANY segment fails to parse,
 * the whole value returns `null` so the caller can fall back to
 * customProperties — partial parses would silently drop user shadows.
 */
export const parseBoxShadowShorthand = (
  raw: string
): ReadonlyArray<BoxShadowDef> | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return [];
  const segments = splitCssList(trimmed);
  const result: BoxShadowDef[] = [];
  for (const segment of segments) {
    const parsed = parseBoxShadowSegment(segment);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
};

/**
 * Inverse of `parseBoxShadowShorthand`. Empty list → empty string; the
 * caller decides whether to emit nothing or `box-shadow: none`.
 *
 * Output format per shadow:
 *   [`inset `]<x>px <y>px <blur>px[ <spread>px][ <color>]
 *
 * Spread is omitted when 0 (matches the "minimal CSS" convention).
 * Color is omitted when it's the spec default `currentColor` so an
 * explicit-defaulted shadow round-trips text-stable.
 */
export const formatBoxShadowShorthand = (
  shadows: ReadonlyArray<BoxShadowDef>
): string => {
  if (shadows.length === 0) return '';
  return shadows
    .map((s) => {
      const parts: string[] = [];
      if (s.inset) parts.push('inset');
      parts.push(`${s.offsetX}px`);
      parts.push(`${s.offsetY}px`);
      parts.push(`${s.blur}px`);
      if (s.spread !== 0) parts.push(`${s.spread}px`);
      if (s.color !== 'currentColor') parts.push(s.color);
      return parts.join(' ');
    })
    .join(', ');
};

// ---- CSS filters ----------------------------------------------------

const FILTER_CALL_RE = /^([a-zA-Z-]+)\(([^()]*)\)$/;

/**
 * Format a numeric argument compactly — strips trailing zeros so
 * `4.00` becomes `4` and `120.50` becomes `120.5`. Keeps integer
 * inputs integer.
 */
const formatFilterNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(4)));
};

/**
 * Parse a single filter function call (`blur(8px)`,
 * `brightness(120%)`, `hue-rotate(90deg)`) into a `FilterDef`.
 *
 * The segment must be exactly one balanced function call. The
 * function name is matched case-insensitively against the
 * `FilterKind` set; the argument inside the parens is parsed as a
 * number with the kind's canonical unit.
 *
 * Refuses (returns null) when:
 *   - the function name is not a known `FilterKind`
 *   - the argument is missing, empty, or contains nested parens
 *     (`blur(var(--md))`, `brightness(calc(100% + 20%))`)
 *   - the unit doesn't match the kind (e.g. `blur(50%)`)
 *   - the numeric portion is unparseable
 *
 * Special case: `blur(0)` (unitless zero) parses as `0px` because
 * zero length is unambiguous in CSS. The exemption applies only to
 * the length-typed `blur` kind.
 *
 * Callers (the cssPropertyMap mapper) treat null as
 * "preserve verbatim in customProperties".
 */
export const parseFilterFunction = (segment: string): FilterDef | null => {
  if (typeof segment !== 'string') return null;
  const trimmed = segment.trim();
  if (trimmed.length === 0) return null;

  const match = trimmed.match(FILTER_CALL_RE);
  if (!match) return null;

  const name = match[1]!.toLowerCase();
  if (!isFilterKind(name)) return null;

  const kind: FilterKind = name;
  const arg = match[2]!.trim();
  if (arg.length === 0) return null;

  const expectedUnit = FILTER_UNITS[kind];

  // Unitless zero is allowed for blur (length-typed kind only).
  if (expectedUnit === 'px' && /^-?0(?:\.0+)?$/.test(arg)) {
    return { kind, value: 0 };
  }

  // Build a unit-specific regex once per call. Each kind only
  // accepts its canonical unit — any other unit refuses.
  let numberPart: string | null = null;
  if (expectedUnit === 'px') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)px$/i);
    if (m) numberPart = m[1]!;
  } else if (expectedUnit === '%') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (m) numberPart = m[1]!;
  } else if (expectedUnit === 'deg') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)deg$/i);
    if (m) numberPart = m[1]!;
  }

  if (numberPart === null) return null;
  const value = Number(numberPart);
  if (!Number.isFinite(value)) return null;

  return { kind, value };
};

/**
 * Parse a full `filter` / `backdrop-filter` value (space-separated
 * list of function calls) into an ordered list of `FilterDef`s.
 *
 * `none`, an empty string, or whitespace returns []. If ANY function
 * fails to parse, the whole value returns `null` so the caller can
 * fall back to customProperties — partial parses would silently
 * drop user filters.
 *
 * Tokenization is paren-aware via `tokenizeShorthandSegment` so a
 * hypothetical `drop-shadow(0 4px rgba(0,0,0,0.5))` is one token
 * (which then refuses as an unknown kind and the whole list
 * refuses). Filter functions are space-separated per the CSS spec —
 * commas inside a function's argument list don't separate functions.
 */
export const parseFilterList = (
  raw: string
): ReadonlyArray<FilterDef> | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') return [];
  const tokens = tokenizeShorthandSegment(trimmed);
  if (tokens.length === 0) return null;
  const result: FilterDef[] = [];
  for (const token of tokens) {
    const parsed = parseFilterFunction(token);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
};

/**
 * Inverse of `parseFilterList`. Empty list → empty string; the
 * caller decides whether to emit nothing or `filter: none`.
 *
 * Output format (one function per token, order preserved, space-
 * joined):
 *   blur(8px) brightness(120%) hue-rotate(90deg)
 *
 * Numeric formatting strips trailing zeros so `8.00` becomes `8` and
 * `120.0` becomes `120`.
 */
export const formatFilterList = (
  filters: ReadonlyArray<FilterDef>
): string => {
  if (filters.length === 0) return '';
  return filters
    .map((f) => `${f.kind}(${formatFilterNumber(f.value)}${FILTER_UNITS[f.kind]})`)
    .join(' ');
};

// ---- Shadow color decomposition --------------------------------------
//
// The Shadow section surfaces the color and the alpha as two separate
// controls (a ColorInput for the base hex, and a NumberInput for the
// opacity %). The data layer keeps storing the combined CSS string in
// `BoxShadowDef.color` — these helpers split / re-combine for the UI.
//
// `var()`, named colors, `currentColor`, and other non-decomposable
// values are returned as-is with `decomposable: false` so the section
// can disable the opacity field rather than silently flattening a
// token reference.

const HEX6_COLOR_RE = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const HEX3_COLOR_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const RGBA_COLOR_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(-?[\d.]+)\s*)?\)$/;

/**
 * Split a CSS color into a base hex (without alpha) and an alpha 0..1.
 *
 * - `#rrggbb` / `#rgb`         → base = `#rrggbb`, alpha = 1, decomposable
 * - `rgb(r, g, b)` / `rgba(r, g, b, a)` → base = `#rrggbb`, alpha = a ?? 1
 * - anything else (`var()`, `currentColor`, named, …) → base = original
 *   value, alpha = 1, `decomposable: false` — the caller should disable
 *   the opacity slider so the user doesn't lose the token / keyword.
 *
 * Always returns alpha clamped to [0, 1].
 */
export type SplitShadowColor = {
  base: string;
  alpha: number;
  decomposable: boolean;
  /**
   * True when the source value carried an explicit alpha component
   * (an rgba(...) syntax). Lets callers tell "user hasn't set an
   * opacity yet" apart from "user set opacity to 100".
   */
  hasExplicitAlpha: boolean;
};

const formatHex2 = (n: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, '0');
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${formatHex2(r)}${formatHex2(g)}${formatHex2(b)}`;

export const splitShadowColor = (value: string): SplitShadowColor => {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    return { base: '#000000', alpha: 1, decomposable: true, hasExplicitAlpha: false };
  }
  const hex6 = trimmed.match(HEX6_COLOR_RE);
  if (hex6) {
    return {
      base: `#${hex6[1]!.toLowerCase()}${hex6[2]!.toLowerCase()}${hex6[3]!.toLowerCase()}`,
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    };
  }
  const hex3 = trimmed.match(HEX3_COLOR_RE);
  if (hex3) {
    const r = hex3[1]!;
    const g = hex3[2]!;
    const b = hex3[3]!;
    return {
      base: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(),
      alpha: 1,
      decomposable: true,
      hasExplicitAlpha: false,
    };
  }
  const rgba = trimmed.match(RGBA_COLOR_RE);
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const aRaw = rgba[4];
    const alpha = aRaw === undefined ? 1 : Math.max(0, Math.min(1, Number(aRaw)));
    return {
      base: rgbToHex(r, g, b),
      alpha,
      decomposable: true,
      hasExplicitAlpha: aRaw !== undefined,
    };
  }
  // var(), currentColor, named colors, modern color() / oklch() … —
  // can't decompose without resolving the value. Surface as-is.
  return { base: trimmed, alpha: 1, decomposable: false, hasExplicitAlpha: false };
};

/**
 * Inverse of `splitShadowColor`. Given a base color and an alpha 0..1,
 * produce the canonical CSS string the panel writes back to
 * `BoxShadowDef.color`.
 *
 * For decomposable bases (hex / rgb), always emits `rgba(...)` — the
 * Shadows section deliberately normalises here so the file never holds
 * a hex+separate-opacity in two places. Non-decomposable bases (`var()`,
 * `currentColor`, named) are passed through unchanged: an alpha
 * component can't be safely tacked on without losing the reference.
 */
export const combineShadowColor = (base: string, alpha: number): string => {
  const trimmedBase = (base ?? '').trim();
  if (trimmedBase.length === 0) return '';
  const a = Math.max(0, Math.min(1, alpha));

  const hex6 = trimmedBase.match(HEX6_COLOR_RE);
  if (hex6) {
    const r = parseInt(hex6[1]!, 16);
    const g = parseInt(hex6[2]!, 16);
    const b = parseInt(hex6[3]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  const hex3 = trimmedBase.match(HEX3_COLOR_RE);
  if (hex3) {
    const r = parseInt(hex3[1]! + hex3[1]!, 16);
    const g = parseInt(hex3[2]! + hex3[2]!, 16);
    const b = parseInt(hex3[3]! + hex3[3]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  const rgba = trimmedBase.match(RGBA_COLOR_RE);
  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    return `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
  // var() / named / unknown — return verbatim. The opacity slider
  // should be disabled in this case anyway.
  return trimmedBase;
};

/**
 * Trim trailing zeros on the alpha component while keeping at most
 * three decimal places. Keeps the file output readable: `0.15` rather
 * than `0.15000000000000002`.
 */
const formatAlpha = (a: number): string => {
  if (a === 0) return '0';
  if (a === 1) return '1';
  return Number(a.toFixed(3)).toString();
};

// ---- Free-form width / height parsing -------------------------------
//
// The Size section's W/H inputs accept any CSS length (`100`, `100px`,
// `100vh`, `100%`, `calc(...)`, `var(--w)`, `auto`, `fit-content`).
// These helpers turn the user's typed string into the right
// combination of typed `widthMode` / `widthValue` and the optional
// verbatim `widthCustom` field — the same routing the cssPropertyMap
// mapper uses on parse, exposed for the panel to share.

/** A free-form CSS length parsed into Scamp's typed width/height shape. */
export type ParsedSizeValue = {
  mode: WidthMode;
  /**
   * Best-effort integer-pixel value for canvas resize math. Only
   * meaningful when `mode === 'fixed'` — for non-fixed modes the
   * caller should leave the existing `widthValue` / `heightValue`
   * untouched.
   */
  value: number;
  /**
   * Verbatim CSS string when the input wasn't a plain px number.
   * `undefined` for plain `Npx`, mode keywords, or empty input.
   */
  custom: string | undefined;
};

const PLAIN_PX_RE = /^(-?\d+(?:\.\d+)?)(?:px)?$/i;
const LEADING_NUMBER_RE = /^(-?\d+(?:\.\d+)?)/;

/**
 * Turn a user-typed CSS length into Scamp's width/height shape.
 *
 * Behaviour:
 * - empty / whitespace → `auto` (no value change)
 * - `auto`, `fit-content`, `100%` → matching mode keyword
 * - bare number (`100`) or `Npx` → fixed, value = N, no custom
 * - anything else (`100vh`, `2em`, `calc(...)`, `var(--w)`) → fixed,
 *   value = leading number (or 0 if none), custom = verbatim string
 *
 * The `mode` field is one value of the shared WidthMode/HeightMode
 * union (they're the same union under different aliases). Callers
 * widen as needed.
 */
export const parseSizeValue = (raw: string): ParsedSizeValue => {
  const trimmed = (raw ?? '').trim();
  if (trimmed.length === 0) return { mode: 'auto', value: 0, custom: undefined };
  const lower = trimmed.toLowerCase();
  if (lower === 'auto') return { mode: 'auto', value: 0, custom: undefined };
  if (lower === 'fit-content') {
    return { mode: 'fit-content', value: 0, custom: undefined };
  }
  if (lower === '100%') {
    return { mode: 'stretch', value: 0, custom: undefined };
  }

  const px = trimmed.match(PLAIN_PX_RE);
  if (px) {
    return {
      mode: 'fixed',
      value: Math.round(Number(px[1])),
      custom: undefined,
    };
  }

  // Anything else: keep verbatim, plus a best-effort numeric prefix
  // so the canvas's resize math has something to fall back on.
  const lead = trimmed.match(LEADING_NUMBER_RE);
  const leadValue = lead ? Math.round(Number(lead[1])) : 0;
  return { mode: 'fixed', value: leadValue, custom: trimmed };
};

/**
 * Inverse of `parseSizeValue` — formats the typed shape back into a
 * single CSS length string. Used by the Size section's input field
 * so the user sees what the canvas / generator will emit.
 */
export const formatSizeValue = (
  mode: WidthMode | HeightMode,
  value: number,
  custom: string | undefined
): string => {
  if (mode === 'fixed') {
    if (custom !== undefined && custom.length > 0) return custom;
    return `${value}px`;
  }
  if (mode === 'stretch') return '100%';
  if (mode === 'fit-content') return 'fit-content';
  return 'auto';
};
