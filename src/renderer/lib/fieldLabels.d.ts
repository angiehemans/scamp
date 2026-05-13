/**
 * Single source of truth for human-readable CSS-property names
 * keyed by `ScampElement` field name.
 *
 * Used by:
 *   - `Section.tsx`'s override-indicator tooltip
 *     ("Style Overrides: width, height, opacity").
 *   - `formatHistoryLabel.ts`'s `patch`-kind label
 *     ("Changed background — hero-card_a1b2").
 *
 * Multiple fields can map to the same CSS name when a single
 * concept is split across several typed fields (e.g.
 * widthMode/widthValue/widthCustom → "width"). The override
 * tooltip dedupes; the history label collapses to the first
 * matching name.
 */
export declare const FIELD_LABELS: Record<string, string>;
/** Get a human-readable name for a field, falling back to the field key itself. */
export declare const fieldLabel: (key: string) => string;
