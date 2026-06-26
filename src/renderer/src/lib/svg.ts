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

/** Basic SVG shapes whose paint we care about. Containers (`g`, `svg`),
 *  `<defs>` content, gradients, etc. are excluded. */
const SHAPE_TAGS = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);

const isNonePaint = (value: string | null): boolean =>
  value !== null && value.trim().toLowerCase() === 'none';

/**
 * Drop shapes that paint nothing — `fill:none` AND `stroke:none` once the
 * root's paint is taken into account. Icon sets (Lucide/Tabler) ship a
 * transparent `<path d="M0 0h24v24H0z" fill="none" stroke="none"/>`
 * bounding box; left in place, an element-level `fill` would inherit down
 * and paint it solid (covering the artwork). Removing it loses nothing
 * visual and lets recolouring work via the wrapper's fill/stroke without
 * touching `svgSource` (keeping it valid JSX — no inline `style` strings,
 * no `var()` that an SVG attribute won't resolve).
 * see docs/notes/svg-recolor.md
 */
const dropInvisibleShapes = (
  svg: SVGElement,
  rootPaint: { fill?: string; stroke?: string }
): void => {
  for (const node of Array.from(svg.querySelectorAll('*'))) {
    if (!SHAPE_TAGS.has(node.tagName.toLowerCase())) continue;
    // Effective paint = own attribute, else the (hoisted) root's, else the
    // SVG initial (fill: black — visible; stroke: none — invisible).
    const fill = node.getAttribute('fill') ?? rootPaint.fill ?? null;
    const stroke = node.getAttribute('stroke') ?? rootPaint.stroke ?? null;
    const fillInvisible = isNonePaint(fill); // null fill = black = visible
    const strokeInvisible = stroke === null || isNonePaint(stroke);
    if (fillInvisible && strokeInvisible) node.remove();
  }
};

/**
 * Pull the root `<svg>`'s own `fill` / `stroke` / `stroke-width` (common on
 * outline icon sets like Lucide) into element-level values — Scamp
 * regenerates the `<svg>` wrapper, so without this the root's paint is
 * lost. Inheriting shapes pick these up; they're also the SvgSection's
 * starting values.
 */
const hoistRootPaint = (
  svg: SVGElement
): { fill?: string; stroke?: string; strokeWidth?: number } => {
  const out: { fill?: string; stroke?: string; strokeWidth?: number } = {};
  const fill = svg.getAttribute('fill');
  if (fill !== null && fill.trim().length > 0) out.fill = fill.trim();
  const stroke = svg.getAttribute('stroke');
  if (stroke !== null && stroke.trim().length > 0) out.stroke = stroke.trim();
  const sw = parseLength(svg.getAttribute('stroke-width'));
  if (sw !== undefined) out.strokeWidth = sw;
  return out;
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
export const prepareSvgForInsert = (raw: string): PreparedSvg | null => {
  const clean = sanitizeSvg(raw);
  if (clean.trim().length === 0) return null;

  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  const rootPaint = hoistRootPaint(svg);
  dropInvisibleShapes(svg, rootPaint);

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
    ...(rootPaint.fill !== undefined ? { fill: rootPaint.fill } : {}),
    ...(rootPaint.stroke !== undefined ? { stroke: rootPaint.stroke } : {}),
    ...(rootPaint.strokeWidth !== undefined
      ? { strokeWidth: rootPaint.strokeWidth }
      : {}),
  };
};
