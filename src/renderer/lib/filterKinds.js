/**
 * Single source of truth for the CSS filter function set Scamp
 * models as typed entries. The parser (`parseFilterFunction`),
 * formatter (`formatFilterList`), and panel UI all derive their
 * tables from this module so a kind added here is automatically
 * recognised by the parser AND surfaced in the dropdown.
 */
export const FILTER_KINDS = [
    'blur',
    'brightness',
    'contrast',
    'grayscale',
    'hue-rotate',
    'invert',
    'opacity',
    'saturate',
    'sepia',
];
const FILTER_KIND_SET = new Set(FILTER_KINDS);
/** Type-guard for the parser. */
export const isFilterKind = (v) => FILTER_KIND_SET.has(v);
/**
 * Per-kind canonical unit. The parser uses this to validate that the
 * author's argument matches the spec-allowed unit (e.g. `blur(50%)`
 * refuses because blur takes a length, not a percentage). The
 * formatter uses it to emit the right suffix.
 */
export const FILTER_UNITS = {
    blur: 'px',
    brightness: '%',
    contrast: '%',
    grayscale: '%',
    'hue-rotate': 'deg',
    invert: '%',
    opacity: '%',
    saturate: '%',
    sepia: '%',
};
/**
 * Per-kind default value used by the "+ Add filter" button and when
 * the user switches a row's kind. Picked so the row produces a
 * visibly-different result the moment it's added:
 *
 *   - kinds that default to "no effect" → their no-op value
 *     (brightness, contrast, hue-rotate, opacity, saturate)
 *   - kinds where the user typically wants full-then-dial-back →
 *     100% (grayscale, invert, sepia)
 *   - blur → a modest 4px so users see something
 */
export const FILTER_DEFAULTS = {
    blur: 4,
    brightness: 100,
    contrast: 100,
    grayscale: 100,
    'hue-rotate': 0,
    invert: 100,
    opacity: 100,
    saturate: 100,
    sepia: 100,
};
/**
 * UI-side slider clamps. The data layer accepts any finite number
 * (agent-written out-of-range values round-trip without clipping),
 * but the panel inputs constrain the user to these ranges.
 */
export const FILTER_RANGES = {
    blur: { min: 0, max: 100 },
    brightness: { min: 0, max: 200 },
    contrast: { min: 0, max: 200 },
    grayscale: { min: 0, max: 100 },
    'hue-rotate': { min: 0, max: 360 },
    invert: { min: 0, max: 100 },
    opacity: { min: 0, max: 100 },
    saturate: { min: 0, max: 200 },
    sepia: { min: 0, max: 100 },
};
/** Human-readable labels for the dropdown. */
export const FILTER_LABELS = {
    blur: 'Blur',
    brightness: 'Brightness',
    contrast: 'Contrast',
    grayscale: 'Grayscale',
    'hue-rotate': 'Hue rotate',
    invert: 'Invert',
    opacity: 'Opacity',
    saturate: 'Saturate',
    sepia: 'Sepia',
};
