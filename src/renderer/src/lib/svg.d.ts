/**
 * Cheap structural check: does this text look like an SVG document?
 * Tolerates a leading XML declaration and/or comments before `<svg>`.
 * Pure string test — safe to call on arbitrary clipboard text.
 */
export declare const isSvgMarkup: (text: string) => boolean;
/**
 * Sanitize SVG markup for safe injection into the DOM. DOMPurify's SVG
 * profile drops `<script>`, `<foreignObject>`, `on*` handlers, external
 * `href`s, and other execution/exfiltration vectors. Returns a sanitized
 * `<svg>…</svg>` string, or `''` when the input has no usable svg.
 */
export declare const sanitizeSvg: (raw: string) => string;
export type PreparedSvg = {
    /** Sanitized, normalized inner markup (what `svgSource` stores). */
    svgSource: string;
    /** `viewBox` attribute if present, e.g. "0 0 24 24". */
    viewBox?: string;
    /** Intrinsic width/height in px when derivable (attrs, else viewBox). */
    width?: number;
    height?: number;
};
/**
 * Sanitize + normalize raw SVG markup for insertion as an inline Scamp
 * `<svg>` element. Returns the inner source (matching the `svgSource`
 * model), the viewBox, and an intrinsic size, or `null` when the input
 * isn't a usable SVG. Pure with respect to its argument (operates on a
 * detached parse, never the live document).
 */
export declare const prepareSvgForInsert: (raw: string) => PreparedSvg | null;
