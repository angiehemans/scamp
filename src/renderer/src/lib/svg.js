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
export const isSvgMarkup = (text) => /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s/>]/i.test(text);
/**
 * Sanitize SVG markup for safe injection into the DOM. DOMPurify's SVG
 * profile drops `<script>`, `<foreignObject>`, `on*` handlers, external
 * `href`s, and other execution/exfiltration vectors. Returns a sanitized
 * `<svg>…</svg>` string, or `''` when the input has no usable svg.
 */
export const sanitizeSvg = (raw) => DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
});
/**
 * Sanitize the INNER markup of an svg (its shape content, i.e. what
 * `svgSource` stores) for safe injection into a rendered `<svg>` on the
 * canvas via `dangerouslySetInnerHTML`. Wraps the fragment so DOMPurify's
 * svg profile applies, then returns the sanitized inner content.
 */
export const sanitizeSvgInner = (inner) => {
    if (inner.trim().length === 0)
        return '';
    const clean = sanitizeSvg(`<svg>${inner}</svg>`);
    const open = clean.indexOf('>');
    const close = clean.lastIndexOf('</svg>');
    if (open < 0 || close < 0 || close <= open)
        return '';
    return clean.slice(open + 1, close);
};
/** CSS custom properties the element-level fill/stroke set, that the
 *  shapes' rewritten paint reads. */
const PAINT_VAR = { fill: '--svg-fill', stroke: '--svg-stroke' };
/**
 * Rewrite each shape's own `fill`/`stroke` presentation attribute into an
 * inline-style CSS variable with the original as fallback —
 * `fill="#f00"` → `style="fill: var(--svg-fill, #f00)"`. The element-level
 * paint then sets `--svg-fill` / `--svg-stroke` to recolour every shape
 * reliably (including `fill="none"`, `currentColor`, and gradient refs),
 * while the fallback preserves the original until a colour is chosen.
 * The root `<svg>` is handled by hoisting (below), not here.
 * see docs/plans/svg-improvements-plan.md
 */
const varifyShapePaint = (svg) => {
    for (const node of Array.from(svg.querySelectorAll('*'))) {
        const extra = [];
        for (const attr of ['fill', 'stroke']) {
            const value = node.getAttribute(attr);
            if (value === null)
                continue;
            extra.push(`${attr}: var(${PAINT_VAR[attr]}, ${value.trim()})`);
            node.removeAttribute(attr);
        }
        if (extra.length === 0)
            continue;
        const existing = (node.getAttribute('style') ?? '').trim().replace(/;$/, '');
        node.setAttribute('style', existing.length > 0 ? `${existing}; ${extra.join('; ')}` : extra.join('; '));
    }
};
/**
 * Pull the root `<svg>`'s own `fill` / `stroke` / `stroke-width` (common on
 * outline icon sets like Lucide) into element-level values — Scamp
 * regenerates the `<svg>` wrapper, so without this the root's paint is
 * lost. Inheriting shapes pick these up; they're also the SvgSection's
 * starting values.
 */
const hoistRootPaint = (svg) => {
    const out = {};
    const fill = svg.getAttribute('fill');
    if (fill !== null && fill.trim().length > 0)
        out.fill = fill.trim();
    const stroke = svg.getAttribute('stroke');
    if (stroke !== null && stroke.trim().length > 0)
        out.stroke = stroke.trim();
    const sw = parseLength(svg.getAttribute('stroke-width'));
    if (sw !== undefined)
        out.strokeWidth = sw;
    return out;
};
/** Parse an SVG length attribute (`24`, `24px`) to a number. Returns
 *  undefined for percentages, ems, or anything non-numeric — the caller
 *  falls back to viewBox or a default size. */
const parseLength = (value) => {
    if (value === null)
        return undefined;
    const m = /^\s*(\d+(?:\.\d+)?)(px)?\s*$/.exec(value);
    if (!m)
        return undefined;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : undefined;
};
/**
 * Sanitize + normalize raw SVG markup for insertion as an inline Scamp
 * `<svg>` element. Returns the inner source (matching the `svgSource`
 * model), the viewBox, and an intrinsic size, or `null` when the input
 * isn't a usable SVG. Pure with respect to its argument (operates on a
 * detached parse, never the live document).
 */
export const prepareSvgForInsert = (raw) => {
    const clean = sanitizeSvg(raw);
    if (clean.trim().length === 0)
        return null;
    const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
    if (doc.querySelector('parsererror'))
        return null;
    const svg = doc.querySelector('svg');
    if (!svg)
        return null;
    const rootPaint = hoistRootPaint(svg);
    varifyShapePaint(svg);
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
