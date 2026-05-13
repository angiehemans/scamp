import type { FilterKind } from './element';
/**
 * Single source of truth for the CSS filter function set Scamp
 * models as typed entries. The parser (`parseFilterFunction`),
 * formatter (`formatFilterList`), and panel UI all derive their
 * tables from this module so a kind added here is automatically
 * recognised by the parser AND surfaced in the dropdown.
 */
export declare const FILTER_KINDS: ReadonlyArray<FilterKind>;
/** Type-guard for the parser. */
export declare const isFilterKind: (v: string) => v is FilterKind;
/**
 * Per-kind canonical unit. The parser uses this to validate that the
 * author's argument matches the spec-allowed unit (e.g. `blur(50%)`
 * refuses because blur takes a length, not a percentage). The
 * formatter uses it to emit the right suffix.
 */
export declare const FILTER_UNITS: Record<FilterKind, 'px' | '%' | 'deg'>;
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
export declare const FILTER_DEFAULTS: Record<FilterKind, number>;
/**
 * UI-side slider clamps. The data layer accepts any finite number
 * (agent-written out-of-range values round-trip without clipping),
 * but the panel inputs constrain the user to these ranges.
 */
export declare const FILTER_RANGES: Record<FilterKind, {
    min: number;
    max: number;
}>;
/** Human-readable labels for the dropdown. */
export declare const FILTER_LABELS: Record<FilterKind, string>;
