import { DEFAULT_RECT_STYLES } from './defaults';
import { isPresetName } from './animationPresets';
/**
 * Parse a `123px` (or bare number) into an integer. Returns 0 for empty
 * or unparseable input — keeps callers from having to special-case missing
 * values themselves.
 */
export const parsePx = (raw) => {
    if (typeof raw !== 'string')
        return 0;
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        return 0;
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
    if (!match || match[1] === undefined)
        return 0;
    return Math.round(Number(match[1]));
};
const VALID_BORDER_STYLES = new Set([
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
const isBorderStyle = (token) => token === 'none' || token === 'solid' || token === 'dashed' || token === 'dotted';
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
export const parseBorderShorthand = (raw) => {
    const fallback = {
        borderWidth: 0,
        borderStyle: DEFAULT_RECT_STYLES.borderStyle,
        borderColor: DEFAULT_RECT_STYLES.borderColor,
    };
    if (typeof raw !== 'string')
        return fallback;
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        return fallback;
    const tokens = tokenizeBorder(trimmed);
    if (tokens.length === 0)
        return fallback;
    // `border: none` (or `0`) — no border at all.
    if (tokens.length === 1) {
        const only = tokens[0];
        if (only === 'none' || only === '0' || only === '0px') {
            return { borderWidth: 0, borderStyle: 'none', borderColor: fallback.borderColor };
        }
    }
    let width = null;
    let style = null;
    let color = null;
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
const tokenizeBorder = (input) => {
    const tokens = [];
    let current = '';
    let depth = 0;
    for (const ch of input) {
        if (ch === '(')
            depth += 1;
        if (ch === ')')
            depth -= 1;
        if (/\s/.test(ch) && depth === 0) {
            if (current.length > 0)
                tokens.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.length > 0)
        tokens.push(current);
    return tokens;
};
/**
 * Parse a CSS `padding` shorthand into [top, right, bottom, left] in px.
 *
 * Supports the standard 1-, 2-, 3-, and 4-value forms.
 */
export const parsePaddingShorthand = (raw) => {
    if (typeof raw !== 'string')
        return [0, 0, 0, 0];
    const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0)
        return [0, 0, 0, 0];
    const v = tokens.map(parsePx);
    if (v.length === 1) {
        const [a] = v;
        return [a, a, a, a];
    }
    if (v.length === 2) {
        const [a, b] = v;
        return [a, b, a, b];
    }
    if (v.length === 3) {
        const [a, b, c] = v;
        return [a, b, c, b];
    }
    const [a, b, c, d] = v;
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
export const parseBorderRadiusShorthand = (raw) => {
    if (typeof raw !== 'string')
        return [0, 0, 0, 0];
    // Strip everything after `/` (vertical radius for elliptical corners).
    const horizontal = raw.split('/')[0] ?? '';
    const tokens = horizontal.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0)
        return [0, 0, 0, 0];
    const v = tokens.map(parsePx);
    if (v.length === 1) {
        const [a] = v;
        return [a, a, a, a];
    }
    if (v.length === 2) {
        const [a, b] = v;
        return [a, b, a, b];
    }
    if (v.length === 3) {
        const [a, b, c] = v;
        return [a, b, c, b];
    }
    const [a, b, c, d] = v;
    return [a, b, c, d];
};
// ---- Transitions ---------------------------------------------------
const NAMED_EASINGS = new Set([
    'ease',
    'linear',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'step-start',
    'step-end',
]);
const TIME_RE = /^(-?\d+(?:\.\d+)?)(ms|s)$/i;
const parseTimeMs = (token) => {
    const m = token.match(TIME_RE);
    if (!m || m[1] === undefined || m[2] === undefined)
        return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n))
        return null;
    return m[2].toLowerCase() === 's' ? Math.round(n * 1000) : Math.round(n);
};
/**
 * Split a CSS value-list on top-level commas, respecting parens. Used
 * to break a `transition` shorthand like
 *   `opacity 200ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1)`
 * into per-transition segments without splitting inside cubic-bezier.
 */
export const splitCssList = (raw) => {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (ch === '(')
            depth += 1;
        else if (ch === ')')
            depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) {
            out.push(raw.slice(start, i).trim());
            start = i + 1;
        }
    }
    const tail = raw.slice(start).trim();
    if (tail.length > 0)
        out.push(tail);
    return out;
};
/**
 * Tokenize a single transition segment into space-separated tokens
 * with parens (cubic-bezier, steps) kept intact.
 */
const tokenizeTransitionSegment = (raw) => {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (ch === '(')
            depth += 1;
        else if (ch === ')')
            depth = Math.max(0, depth - 1);
        else if (depth === 0 && /\s/.test(ch)) {
            const tok = raw.slice(start, i).trim();
            if (tok.length > 0)
                out.push(tok);
            start = i + 1;
        }
    }
    const tail = raw.slice(start).trim();
    if (tail.length > 0)
        out.push(tail);
    return out;
};
const isEasingToken = (token) => {
    if (NAMED_EASINGS.has(token.toLowerCase()))
        return true;
    if (/^cubic-bezier\(/i.test(token))
        return true;
    if (/^steps\(/i.test(token))
        return true;
    return false;
};
/**
 * Parse a single transition segment (`opacity 200ms ease 100ms`) into
 * a TransitionDef. Per the CSS spec, the first `<time>` token is the
 * duration and the second is the delay; any keyword in the easing set
 * (or `cubic-bezier(...)` / `steps(...)`) is the easing; the leftover
 * non-time / non-easing token is the property name.
 */
export const parseTransitionSegment = (segment) => {
    const tokens = tokenizeTransitionSegment(segment);
    if (tokens.length === 0)
        return null;
    let durationMs = null;
    let delayMs = null;
    let easing = null;
    let property = null;
    for (const token of tokens) {
        const time = parseTimeMs(token);
        if (time !== null) {
            if (durationMs === null)
                durationMs = time;
            else if (delayMs === null)
                delayMs = time;
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
export const parseTransitionShorthand = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed === 'none')
        return [];
    const segments = splitCssList(trimmed);
    const result = [];
    for (const segment of segments) {
        const parsed = parseTransitionSegment(segment);
        if (parsed)
            result.push(parsed);
    }
    return result;
};
/**
 * Format a duration / delay number into the most readable CSS
 * representation. Whole-second values come back as `1s`; everything
 * else stays in `ms`.
 */
export const formatTransitionTime = (ms) => {
    if (ms === 0)
        return '0ms';
    if (ms % 1000 === 0)
        return `${ms / 1000}s`;
    return `${ms}ms`;
};
/**
 * Inverse of `parseTransitionShorthand`. Empty list → empty string;
 * the caller decides whether to emit nothing or `transition: none`.
 */
export const formatTransitionShorthand = (transitions) => {
    if (transitions.length === 0)
        return '';
    return transitions
        .map((t) => {
        const parts = [
            t.property,
            formatTransitionTime(t.durationMs),
            t.easing,
        ];
        if (t.delayMs !== 0)
            parts.push(formatTransitionTime(t.delayMs));
        return parts.join(' ');
    })
        .join(', ');
};
// ---- Refusable variants ---------------------------------------------
//
// The classic `parsePx` / `parsePaddingShorthand` / `parseBorderRadiusShorthand`
// helpers return 0 / [0,0,0,0] for any input they can't interpret, which
// is convenient for typed canvas state but lossy when an agent has
// written something Scamp doesn't model — `padding: var(--space-4)`,
// `border-radius: 50%`, `padding: 16px var(--inline)`, etc.
//
// These refusable variants return `null` instead so the cssPropertyMap
// can detect "Scamp can't reduce this to typed fields" and fall through
// to `customProperties` with the raw declaration intact. The original
// helpers stay put for callers that need a non-null number.
/**
 * Like `parsePx` but returns `null` for non-px tokens (so callers can
 * preserve `var()`, `%`, `rem`, etc. by falling through to
 * customProperties).
 */
export const parsePxOrNull = (raw) => {
    if (typeof raw !== 'string')
        return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0)
        return null;
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);
    if (!match || match[1] === undefined)
        return null;
    return Math.round(Number(match[1]));
};
/**
 * Refusable variant of `parsePaddingShorthand`. Returns `null` if any
 * token is non-px (`var()`, `%`, `rem`, `auto`, …) so the caller can
 * preserve the declaration verbatim.
 */
export const parsePaddingShorthandOrNull = (raw) => {
    if (typeof raw !== 'string')
        return null;
    const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0)
        return null;
    const v = [];
    for (const tok of tokens) {
        const n = parsePxOrNull(tok);
        if (n === null)
            return null;
        v.push(n);
    }
    if (v.length === 1) {
        const [a] = v;
        return [a, a, a, a];
    }
    if (v.length === 2) {
        const [a, b] = v;
        return [a, b, a, b];
    }
    if (v.length === 3) {
        const [a, b, c] = v;
        return [a, b, c, b];
    }
    if (v.length === 4) {
        const [a, b, c, d] = v;
        return [a, b, c, d];
    }
    return null;
};
/**
 * Refusable variant of `parseBorderRadiusShorthand`. Anything other
 * than 1–4 px tokens (e.g. `50%`, `var()`) → returns null so the raw
 * declaration round-trips via customProperties.
 */
export const parseBorderRadiusShorthandOrNull = (raw) => {
    if (typeof raw !== 'string')
        return null;
    // Reject elliptical-corner shorthand entirely so the slash form
    // round-trips verbatim instead of being silently truncated.
    if (raw.includes('/'))
        return null;
    return parsePaddingShorthandOrNull(raw);
};
// ---- Animations ----------------------------------------------------
const ANIMATION_DIRECTIONS = new Set([
    'normal',
    'reverse',
    'alternate',
    'alternate-reverse',
]);
const ANIMATION_FILL_MODES = new Set([
    'none',
    'forwards',
    'backwards',
    'both',
]);
const ANIMATION_PLAY_STATES = new Set([
    'running',
    'paused',
]);
/**
 * Reserved CSS keywords the animation shorthand uses for typed
 * fields. The custom-ident NAME of an animation can't collide with
 * any of these (CSS spec rule), so we use them to disambiguate
 * which token is the name on parse.
 */
const ANIMATION_RESERVED_KEYWORDS = new Set([
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
const isAnimationDirection = (token) => ANIMATION_DIRECTIONS.has(token);
const isAnimationFillMode = (token) => ANIMATION_FILL_MODES.has(token);
const isAnimationPlayState = (token) => ANIMATION_PLAY_STATES.has(token);
/**
 * Reuse the transition-segment tokenizer — same shape: space-
 * separated tokens, paren groups (cubic-bezier, steps) kept intact.
 * Re-exposed via a thin wrapper so the symbol stays internal.
 */
const tokenizeAnimationSegment = (raw) => {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (ch === '(')
            depth += 1;
        else if (ch === ')')
            depth = Math.max(0, depth - 1);
        else if (depth === 0 && /\s/.test(ch)) {
            const tok = raw.slice(start, i).trim();
            if (tok.length > 0)
                out.push(tok);
            start = i + 1;
        }
    }
    const tail = raw.slice(start).trim();
    if (tail.length > 0)
        out.push(tail);
    return out;
};
/**
 * Parse an `<animation-iteration-count>` token: either `infinite` or
 * a finite number. Returns null when the token isn't a valid count.
 */
const parseIterationCount = (token) => {
    const lower = token.toLowerCase();
    if (lower === 'infinite')
        return 'infinite';
    if (!/^-?\d+(?:\.\d+)?$/.test(token))
        return null;
    const n = Number(token);
    if (!Number.isFinite(n) || n < 0)
        return null;
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
export const parseAnimationShorthand = (raw) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === 'none')
        return null;
    // Reject multi-animation source (comma at top level) — caller
    // routes the whole declaration to customProperties verbatim.
    if (splitCssList(trimmed).length > 1)
        return null;
    const tokens = tokenizeAnimationSegment(trimmed);
    if (tokens.length === 0)
        return null;
    let durationMs = null;
    let delayMs = null;
    let easing = null;
    let iterationCount = null;
    let direction = null;
    let fillMode = null;
    let playState = null;
    let name = null;
    for (const token of tokens) {
        const lower = token.toLowerCase();
        // Times — duration first, delay second (positional per spec).
        const time = parseTimeMs(token);
        if (time !== null) {
            if (durationMs === null)
                durationMs = time;
            else if (delayMs === null)
                delayMs = time;
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
    if (name === null)
        return null;
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
export const formatAnimationShorthand = (animation) => {
    // Always emit name + duration + easing (matches the
    // `formatTransitionShorthand` convention — easing is the third
    // positional field and authors expect to see it for grokability).
    // The trailing keyword fields (iteration / direction / fill-mode /
    // play-state) are mutually disjoint enum sets, so the spec accepts
    // any subset in any order — only emit non-defaults.
    const parts = [
        animation.name,
        formatTransitionTime(animation.durationMs),
        animation.easing,
    ];
    if (animation.delayMs !== 0) {
        parts.push(formatTransitionTime(animation.delayMs));
    }
    if (animation.iterationCount !== 1) {
        parts.push(animation.iterationCount === 'infinite'
            ? 'infinite'
            : String(animation.iterationCount));
    }
    if (animation.direction !== 'normal')
        parts.push(animation.direction);
    if (animation.fillMode !== 'none')
        parts.push(animation.fillMode);
    if (animation.playState !== 'running')
        parts.push(animation.playState);
    return parts.join(' ');
};
