export type GridTrack = {
    kind: 'fr';
    value: number;
} | {
    kind: 'px';
    value: number;
} | {
    kind: 'percent';
    value: number;
} | {
    kind: 'auto';
} | {
    kind: 'min-content';
} | {
    kind: 'max-content';
} | {
    kind: 'raw';
    source: string;
};
/**
 * Parse a `grid-template-columns` / `-rows` string into an editable
 * track list. Returns:
 *   - `[]` for an empty / whitespace template (no explicit tracks yet).
 *   - `GridTrack[]` for a simple space-separated list (with `minmax()`
 *     etc. preserved as `raw` tracks), or a whole-string `repeat(N, …)`.
 *   - `null` for anything the editor can't model: named lines (`[…]`),
 *     `subgrid` / `masonry`, or `repeat` mixed with other tracks.
 */
export declare const parseGridTemplate: (template: string) => GridTrack[] | null;
/** Serialise a track list to a CSS template string (space-separated). */
export declare const serializeGridTemplate: (tracks: ReadonlyArray<GridTrack>) => string;
/** N equal fractional tracks — the quick N×M picker's output. */
export declare const makeFrTracks: (n: number) => GridTrack[];
