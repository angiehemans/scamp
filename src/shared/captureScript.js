/// <reference lib="dom" />
// The DOM lib is pulled in for this file alone: `src/shared` is compiled
// by the node project too, where `document` and `Element` are rightly
// absent. This is the one shared module that runs in a page.
import { CAPTURED_PROPERTIES, CAPTURE_LIMITS, CAPTURE_VERSION, INHERITED_PROPERTIES, INITIAL_VALUES, CONDITIONAL_PROPERTIES, KEPT_ATTRIBUTES, SKIPPED_TAGS, } from './importCapture';
/** The policy as the page receives it: plain arrays, JSON-safe. */
export const capturePolicy = () => ({
    properties: [...CAPTURED_PROPERTIES],
    initial: { ...INITIAL_VALUES },
    inherited: [...INHERITED_PROPERTIES],
    conditional: { ...CONDITIONAL_PROPERTIES },
    keptAttrs: [...KEPT_ATTRIBUTES],
    skippedTags: [...SKIPPED_TAGS],
    limits: { ...CAPTURE_LIMITS },
    version: CAPTURE_VERSION,
    includeRects: true,
});
/**
 * Walk the rendered document into a `CapturePayload`.
 *
 * Runs in the page. Reads nothing but the DOM and its computed styles,
 * and mutates nothing — an import must never change the page it is
 * reading, not least because the user is still looking at it.
 */
export const captureFn = (policy) => {
    const props = policy.properties;
    const initial = policy.initial;
    const inherited = new Set(policy.inherited);
    const keptAttrs = new Set(policy.keptAttrs);
    const skipped = new Set(policy.skippedTags);
    const { maxDepth, maxNodes, maxTextLength } = policy.limits;
    const pageNotes = [];
    const assets = [];
    let nextId = 0;
    let nodeBudget = maxNodes;
    /** A short, readable path for the report: `div.card > p`. */
    const pathOf = (el) => {
        const parts = [];
        let cur = el;
        for (let i = 0; cur && i < 4; i += 1) {
            const cls = typeof cur.className === 'string' ? cur.className.trim().split(/\s+/)[0] : '';
            parts.unshift(cur.tagName.toLowerCase() + (cls ? `.${cls}` : ''));
            cur = cur.parentElement;
        }
        return parts.join(' > ');
    };
    /** The first `url(...)` in a background-image, resolved absolute. */
    const urlIn = (value) => {
        const m = value.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m || m[1] === undefined)
            return null;
        try {
            return new URL(m[1], document.baseURI).href;
        }
        catch {
            return null;
        }
    };
    const visit = (el, parentStyle, depth) => {
        const tag = el.tagName.toLowerCase();
        if (skipped.has(tag))
            return null;
        const computed = window.getComputedStyle(el);
        // An element the page isn't showing is not part of the design. This
        // also prunes the subtree, which is most of what keeps a real page's
        // node count survivable — menus, modals and tab panels are usually
        // present and hidden.
        if (computed.display === 'none' || computed.visibility === 'hidden')
            return null;
        if (nodeBudget <= 0)
            return null;
        nodeBudget -= 1;
        const id = nextId++;
        const notes = [];
        // Styles: computed, less "nothing set", less inheritance doing its job.
        const styles = {};
        for (const prop of props) {
            const value = computed.getPropertyValue(prop);
            if (!value)
                continue;
            const blank = initial[prop];
            if (blank === value)
                continue;
            if (Array.isArray(blank) && blank.indexOf(value) >= 0)
                continue;
            if (inherited.has(prop) && parentStyle && parentStyle.getPropertyValue(prop) === value) {
                continue;
            }
            styles[prop] = value;
        }
        // Drop values that are a layout result rather than a decision: a
        // border colour with no border, an origin with no transform.
        for (const [prop, requires] of Object.entries(policy.conditional)) {
            if (!(prop in styles))
                continue;
            if (requires === null || !(requires in styles))
                delete styles[prop];
        }
        // Attributes worth carrying. `src` is resolved absolute so the
        // downloader doesn't have to know the page's base URL.
        const attrs = {};
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (!keptAttrs.has(name))
                continue;
            if (name === 'src' || name === 'href') {
                try {
                    attrs[name] = new URL(attr.value, document.baseURI).href;
                }
                catch {
                    attrs[name] = attr.value;
                }
                continue;
            }
            attrs[name] = attr.value;
        }
        if (tag === 'img' && attrs['src']) {
            assets.push({ url: attrs['src'], kind: 'image', fromNodeId: id });
        }
        const bg = styles['background-image'];
        if (bg) {
            const url = urlIn(bg);
            if (url) {
                assets.push({ url, kind: 'image', fromNodeId: id });
                notes.push({ kind: 'background-image', at: pathOf(el), detail: url });
            }
        }
        // Things with no representation in the model. Detected here, where
        // the DOM is, and reported rather than silently dropped.
        for (const pseudo of ['::before', '::after']) {
            const content = window.getComputedStyle(el, pseudo).content;
            if (content && content !== 'none' && content !== 'normal' && content !== '""') {
                notes.push({ kind: 'pseudo-element', at: `${pathOf(el)}${pseudo}`, detail: content });
            }
        }
        if (el.shadowRoot)
            notes.push({ kind: 'shadow-root', at: pathOf(el) });
        if (tag === 'canvas')
            notes.push({ kind: 'canvas', at: pathOf(el) });
        if (tag === 'iframe')
            notes.push({ kind: 'iframe', at: pathOf(el) });
        if (tag === 'svg')
            notes.push({ kind: 'svg', at: pathOf(el) });
        // Direct text, kept separate from element children so the reducer
        // can apply Scamp's rule that text lives in a text element.
        let text = null;
        const ownText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent ?? '')
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
        if (ownText)
            text = ownText.slice(0, maxTextLength);
        const children = [];
        if (depth >= maxDepth) {
            if (el.children.length > 0) {
                notes.push({ kind: 'depth-capped', at: pathOf(el), detail: String(maxDepth) });
            }
        }
        else if (tag !== 'svg') {
            // An svg's internals are its own language; the element is kept,
            // its children are not walked.
            for (const child of Array.from(el.children)) {
                const built = visit(child, computed, depth + 1);
                if (built)
                    children.push(built);
            }
        }
        const built = { id, tag, styles, text, attrs, children, notes };
        if (policy.includeRects) {
            const box = el.getBoundingClientRect();
            built['rect'] = {
                x: Math.round((box.left + window.scrollX) * 100) / 100,
                y: Math.round((box.top + window.scrollY) * 100) / 100,
                w: Math.round(box.width * 100) / 100,
                h: Math.round(box.height * 100) / 100,
            };
        }
        return built;
    };
    const rootEl = document.body;
    const root = visit(rootEl, null, 0);
    if (nodeBudget <= 0) {
        pageNotes.push({ kind: 'node-capped', detail: String(maxNodes) });
    }
    return {
        version: policy.version,
        url: location.href,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        root,
        assets,
        notes: pageNotes,
    };
};
