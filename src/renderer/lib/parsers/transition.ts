// parsers/transition.ts — split out of parsers.ts (4.3).
import { type TransitionDef } from "../element";
import { splitCssList, tokenizeShorthandSegment } from "./common";
import { isEasingToken, parseTimeMs } from "./internal";

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

