import { toPng, toSvg } from 'html-to-image';
import elementStyles from '../canvas/ElementRenderer.module.css';
/**
 * Skip nodes that are part of the editor chrome. The marker
 * `data-canvas-chrome="true"` lives on the `CanvasInteractionLayer`
 * root; descendants (selection overlay, grid overlay, drop indicators,
 * link indicators) inherit by DOM ancestry. We walk up
 * `parentElement` looking for the attribute so a future chrome
 * subtree only needs the marker on its root.
 */
const isChromeNode = (node) => {
    // `html-to-image` calls the filter with every node, including text
    // and other non-element nodes. Only Element nodes can carry the
    // attribute.
    let current = node;
    while (current) {
        if (current.nodeType === 1) {
            const el = current;
            if (el.getAttribute && el.getAttribute('data-canvas-chrome') === 'true') {
                return true;
            }
        }
        current = current.parentNode;
    }
    return false;
};
/**
 * The blue selection outline is painted on the element itself via
 * the `.selected` CSS-module class (see
 * `ElementRenderer.module.css` — `outline: 2px solid var(--accent)`).
 * `data-canvas-chrome` filters the canvas interaction layer but
 * can't strip a class from the element being captured. So for the
 * duration of the capture we remove that class from every element
 * in the subtree, then restore it afterwards.
 *
 * Same pattern is used for the dashed `textEditing` outline, in
 * case a user manages to fire an export while a text element is
 * mid-edit.
 */
const withChromeClassesHidden = async (node, fn) => {
    const chromeClassNames = [
        elementStyles.selected,
        elementStyles.textEditing,
    ].filter((c) => typeof c === 'string' && c.length > 0);
    if (chromeClassNames.length === 0)
        return fn();
    // Capture every element in the subtree (including the root) that
    // currently carries any chrome class, and the specific classes
    // that need restoring. We snapshot only the classes we strip so
    // restoration doesn't clobber any class added between strip and
    // restore (rare, but cheap insurance).
    const restorations = [];
    const candidates = [node, ...node.querySelectorAll('*')];
    for (const el of candidates) {
        const stripped = [];
        for (const cls of chromeClassNames) {
            if (el.classList.contains(cls)) {
                el.classList.remove(cls);
                stripped.push(cls);
            }
        }
        if (stripped.length > 0)
            restorations.push({ el, classes: stripped });
    }
    try {
        return await fn();
    }
    finally {
        for (const { el, classes } of restorations) {
            el.classList.add(...classes);
        }
    }
};
/**
 * `html-to-image` reads each captured element's *applied* transform,
 * so a frame with `transform: scale(0.5)` produces a half-size
 * capture even at `pixelRatio: 1`. The fix: temporarily reset the
 * transform-bearing ancestor's transform to `none` for the duration
 * of the capture, then restore.
 */
const withTransformReset = async (node, fn) => {
    // Walk up looking for the canvas frame, which is the only element
    // we apply `transform: scale(...)` to. Identified by data-testid.
    let target = node;
    while (target && target.getAttribute('data-testid') !== 'canvas-frame') {
        target = target.parentElement;
    }
    if (!target) {
        return fn();
    }
    const original = target.style.transform;
    target.style.transform = 'none';
    try {
        return await fn();
    }
    finally {
        target.style.transform = original;
    }
};
/**
 * Capture a PNG data URL. PNG is rasterised via foreignObject so the
 * output exactly matches what the user sees on the canvas.
 *
 * `pixelRatio` lets us render at 2× / 3× the intrinsic size for
 * crisp images; the resulting data URL decodes to a buffer of
 * `width × scale` × `height × scale` px.
 */
export const capturePng = (inputs) => withTransformReset(inputs.node, () => withChromeClassesHidden(inputs.node, () => toPng(inputs.node, {
    width: inputs.width,
    height: inputs.height,
    pixelRatio: inputs.scale,
    cacheBust: true,
    filter: (n) => !isChromeNode(n),
    ...(inputs.backgroundColor !== null
        ? { backgroundColor: inputs.backgroundColor }
        : {}),
})));
/**
 * Capture an SVG string. Resolution-independent — no `pixelRatio`.
 * Some complex CSS effects (filters, blend modes) may not be fully
 * captured; the panel surfaces a one-line warning to set
 * expectations.
 *
 * `html-to-image`'s `toSvg` returns a `data:image/svg+xml;…` URL
 * rather than raw XML. We decode the URL so the file written to
 * disk is real SVG that browsers and downstream tools can read.
 */
export const captureSvg = async (inputs) => {
    const dataUrl = await withTransformReset(inputs.node, () => withChromeClassesHidden(inputs.node, () => toSvg(inputs.node, {
        width: inputs.width,
        height: inputs.height,
        cacheBust: true,
        filter: (n) => !isChromeNode(n),
        ...(inputs.backgroundColor !== null
            ? { backgroundColor: inputs.backgroundColor }
            : {}),
    })));
    return decodeSvgDataUrl(dataUrl);
};
/**
 * Decode a `data:image/svg+xml;charset=utf-8,<encoded>` URL into
 * raw SVG XML. `html-to-image` URI-encodes the body, so the inverse
 * is a single `decodeURIComponent`. Tolerant of an upstream change
 * to base64 encoding: if the URL announces base64, decode that path.
 */
const decodeSvgDataUrl = (dataUrl) => {
    const comma = dataUrl.indexOf(',');
    if (comma < 0)
        return dataUrl;
    const meta = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    if (/;base64/i.test(meta)) {
        // Browser environment — `atob` is available.
        return atob(body);
    }
    return decodeURIComponent(body);
};
// ---- Pure helpers (testable without DOM) ----------------------------
/**
 * Slugify an export filename. The user can rename in the save dialog;
 * this is just a sane default. Strips path separators and other
 * filename-hostile characters.
 */
export const sanitizeExportFilename = (raw) => raw.replace(/[\\/:*?"<>|]+/g, '').trim() || 'export';
/**
 * Suggest a filename based on the export scope.
 *   - Page scope → the page name (`home`, `about`).
 *   - Element scope → the element's class name (`rect_a1b2`,
 *     `hero-card_a1b2`).
 *
 * The caller passes the resolved name; this helper just sanitises it.
 */
export const suggestExportFilename = (name) => sanitizeExportFilename(name);
