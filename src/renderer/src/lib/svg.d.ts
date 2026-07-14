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
/**
 * Sanitize the INNER markup of an svg (its shape content, i.e. what
 * `svgSource` stores) for safe injection into a rendered `<svg>` on the
 * canvas via `dangerouslySetInnerHTML`. Wraps the fragment so DOMPurify's
 * svg profile applies, then returns the sanitized inner content.
 */
export declare const sanitizeSvgInner: (inner: string) => string;
export type SvgColors = {
    /** Unique concrete colours (first-seen order); `none`/`url(#…)` skipped. */
    colors: string[];
    /** True when any paint uses `currentColor` (edited via CSS `color`). */
    hasCurrentColor: boolean;
};
/**
 * Extract every unique colour used inside an SVG's inner source — from
 * `fill` / `stroke` / `color` / `stop-color` presentation attributes AND
 * inline `style` properties. `currentColor` is flagged separately (it maps
 * to the element's CSS `color`, not a source edit). Pure w.r.t. its input.
 * Returns empty on malformed markup rather than throwing.
 */
export declare const extractSvgColors: (svgSource: string) => SvgColors;
/**
 * Rewrite every occurrence of the colour `from` to `to` inside an SVG's
 * inner source — across paint attributes and inline `style` properties.
 * Case-insensitive on `from`. Leaves `none`, `url(#…)`, and unrelated
 * colours untouched. Returns the input unchanged on malformed markup.
 */
export declare const replaceSvgColor: (svgSource: string, from: string, to: string) => string;
export type PreparedSvg = {
    /** Sanitized, normalized inner markup (what `svgSource` stores). */
    svgSource: string;
    /** `viewBox` attribute if present, e.g. "0 0 24 24". */
    viewBox?: string;
    /** Intrinsic width/height in px when derivable (attrs, else viewBox). */
    width?: number;
    height?: number;
    /** Root `<svg>` paint hoisted into element-level starting values. */
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
};
/**
 * Sanitize + normalize raw SVG markup for insertion as an inline Scamp
 * `<svg>` element. Returns the inner source (matching the `svgSource`
 * model), the viewBox, and an intrinsic size, or `null` when the input
 * isn't a usable SVG. Pure with respect to its argument (operates on a
 * detached parse, never the live document).
 */
export declare const prepareSvgForInsert: (raw: string) => PreparedSvg | null;
