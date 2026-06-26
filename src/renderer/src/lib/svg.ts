// SVG ingestion + safety helpers. DOM-dependent (DOMPurify + DOMParser),
// so this lives under src/renderer/src/lib (alongside exportCapture)
// rather than the env-agnostic src/renderer/lib core. Used by the
// drop/paste insert flows and by ElementRenderer before injecting svg
// markup into the live canvas DOM. see docs/plans/svg-improvements-plan.md
import DOMPurify from 'dompurify';

/**
 * Cheap structural check: does this text look like an SVG document?
 * Tolerates a leading XML declaration and/or comments before `<svg>`.
 * Pure string test — safe to call on arbitrary clipboard text.
 */
export const isSvgMarkup = (text: string): boolean =>
  /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s/>]/i.test(text);

/**
 * Sanitize SVG markup for safe injection into the DOM. DOMPurify's SVG
 * profile drops `<script>`, `<foreignObject>`, `on*` handlers, external
 * `href`s, and other execution/exfiltration vectors. Returns a sanitized
 * `<svg>…</svg>` string, or `''` when the input has no usable svg.
 */
export const sanitizeSvg = (raw: string): string =>
  DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

/**
 * Sanitize the INNER markup of an svg (its shape content, i.e. what
 * `svgSource` stores) for safe injection into a rendered `<svg>` on the
 * canvas via `dangerouslySetInnerHTML`. Wraps the fragment so DOMPurify's
 * svg profile applies, then returns the sanitized inner content.
 */
export const sanitizeSvgInner = (inner: string): string => {
  if (inner.trim().length === 0) return '';
  const clean = sanitizeSvg(`<svg>${inner}</svg>`);
  const open = clean.indexOf('>');
  const close = clean.lastIndexOf('</svg>');
  if (open < 0 || close < 0 || close <= open) return '';
  return clean.slice(open + 1, close);
};

/** A solid-color fill/stroke value the element-level CSS can override by
 *  cascading once the shape's own presentation attribute is removed.
 *  Values we must NOT strip: `none` (intentional), `currentColor` /
 *  `inherit` (already cascades), `url(#…)` (gradient/pattern ref), and
 *  the SVG2 `context-fill` / `context-stroke` keywords. */
const isOverridableColor = (value: string): boolean => {
  const v = value.trim().toLowerCase();
  if (v.length === 0) return false;
  return (
    v !== 'none' &&
    v !== 'currentcolor' &&
    v !== 'inherit' &&
    v !== 'context-fill' &&
    v !== 'context-stroke' &&
    !v.startsWith('url(')
  );
};

/**
 * Strip solid `fill`/`stroke` presentation attributes from every shape so
 * element-level CSS (`.icon { fill; stroke }`) cascades down to recolor
 * them — independently for fill and stroke. `none` and gradient/pattern
 * refs are left intact so outline-only icons and decorative fills survive.
 */
const stripOverridableColors = (svg: SVGElement): void => {
  const nodes = [svg, ...Array.from(svg.querySelectorAll('*'))];
  for (const node of nodes) {
    for (const attr of ['fill', 'stroke'] as const) {
      const value = node.getAttribute(attr);
      if (value !== null && isOverridableColor(value)) {
        node.removeAttribute(attr);
      }
    }
  }
};

/** Parse an SVG length attribute (`24`, `24px`) to a number. Returns
 *  undefined for percentages, ems, or anything non-numeric — the caller
 *  falls back to viewBox or a default size. */
const parseLength = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const m = /^\s*(\d+(?:\.\d+)?)(px)?\s*$/.exec(value);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
};

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
export const prepareSvgForInsert = (raw: string): PreparedSvg | null => {
  const clean = sanitizeSvg(raw);
  if (clean.trim().length === 0) return null;

  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  stripOverridableColors(svg);

  const viewBox = svg.getAttribute('viewBox') ?? undefined;
  let width = parseLength(svg.getAttribute('width'));
  let height = parseLength(svg.getAttribute('height'));
  if ((width === undefined || height === undefined) && viewBox) {
    // viewBox = "min-x min-y width height"
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      width = width ?? parts[2];
      height = height ?? parts[3];
    }
  }

  return {
    svgSource: svg.innerHTML,
    ...(viewBox !== undefined ? { viewBox } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
};
