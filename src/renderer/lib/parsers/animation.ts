// parsers/animation.ts — split out of parsers.ts (4.3).
import { isPresetName } from "../animationPresets";
import { type AnimationDirection, type AnimationFillMode, type AnimationPlayState, type ElementAnimation } from "../element";
import { splitCssList } from "./common";
import { isEasingToken, parseTimeMs } from "./internal";
import { formatTransitionTime } from "./transition";

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

