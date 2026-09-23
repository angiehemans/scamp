/// <reference lib="dom" />
// The DOM lib is pulled in for this file alone: `src/shared` is compiled
// by the node project too, where `document` and `Element` are rightly
// absent. This is the one shared module that runs in a page.
import { CAPTURED_PROPERTIES, CAPTURE_LIMITS, CAPTURE_VERSION, INHERITED_PROPERTIES, INITIAL_VALUES, CONDITIONAL_PROPERTIES, INLINE_MARKUP_ATTRIBUTES, INLINE_MARKUP_TAGS, KEPT_ATTRIBUTES, SKIPPED_TAGS, } from './importCapture';
/** The policy as the page receives it: plain arrays, JSON-safe. */
export const capturePolicy = () => ({
    properties: [...CAPTURED_PROPERTIES],
    initial: { ...INITIAL_VALUES },
    inherited: [...INHERITED_PROPERTIES],
    conditional: { ...CONDITIONAL_PROPERTIES },
    inlineTags: [...INLINE_MARKUP_TAGS],
    inlineAttrs: { ...INLINE_MARKUP_ATTRIBUTES },
    textTags: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'label', 'blockquote',
        'figcaption', 'legend', 'dt', 'dd', 'caption', 'th', 'td', 'a', 'span',
        'strong', 'em', 'small', 'button',
    ],
    keptAttrs: [...KEPT_ATTRIBUTES],
    skippedTags: [...SKIPPED_TAGS],
    limits: { ...CAPTURE_LIMITS },
    version: CAPTURE_VERSION,
    includeRects: true,
});
/**
 * Settle the page before reading it.
 *
 * Modern pages reveal content on scroll: an `IntersectionObserver`
 * flips a class and CSS transitions the element in from `opacity: 0`.
 * Capture the page as loaded and everything below the fold is recorded
 * invisible — which looks, in the imported view, exactly like elements
 * missing. Measured on one site: 21 elements at zero opacity on load,
 * 12 after scrolling through, so 9 were waiting to be seen.
 *
 * Scrolling the whole page and returning to the top triggers those
 * observers, and is what a person would have done before deciding they
 * wanted this page.
 * see docs/plans/website-import-plan.md
 */
export const prepareFn = async () => {
    const step = Math.max(200, window.innerHeight * 0.8);
    const height = document.body.scrollHeight;
    for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
};
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
    const inlineTags = new Set(policy.inlineTags);
    const textTags = new Set(policy.textTags);
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
    const escapeText = (raw) => raw.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
    /**
     * One inline element as JSX-safe markup.
     *
     * Not `outerHTML`: a fragment is emitted verbatim into a `.tsx` file,
     * so `class=` would be a React error and page-specific attributes
     * would be noise. Only the attributes that carry meaning survive.
     */
    const inlineSource = (el, depth) => {
        const tag = el.tagName.toLowerCase();
        if (tag === 'br')
            return '<br />';
        if (depth > 4)
            return escapeText(el.textContent ?? '');
        const allowed = policy.inlineAttrs[tag] ?? [];
        const attrs = [];
        for (const name of allowed) {
            const value = el.getAttribute(name);
            if (value === null)
                continue;
            const resolved = name === 'href'
                ? (() => {
                    try {
                        return new URL(value, document.baseURI).href;
                    }
                    catch {
                        return value;
                    }
                })()
                : value;
            attrs.push(` ${name}="${resolved.replace(/"/g, '&quot;')}"`);
        }
        let inner = '';
        for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === 3) {
                inner += escapeText(child.textContent ?? '');
            }
            else if (child.nodeType === 1) {
                const childEl = child;
                inner += inlineTags.has(childEl.tagName.toLowerCase())
                    ? inlineSource(childEl, depth + 1)
                    : escapeText(childEl.textContent ?? '');
            }
        }
        return `<${tag}${attrs.join('')}>${inner}</${tag}>`;
    };
    /**
     * Running text with inline markup in it, in source order — or null
     * when this node is not that shape.
     */
    const inlineContentOf = (el) => {
        const tag = el.tagName.toLowerCase();
        if (!textTags.has(tag))
            return null;
        const kids = Array.from(el.children);
        if (kids.length === 0)
            return null;
        if (!kids.every((k) => inlineTags.has(k.tagName.toLowerCase())))
            return null;
        const out = [];
        for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === 3) {
                const value = (child.textContent ?? '').replace(/\s+/g, ' ');
                if (value.trim().length > 0)
                    out.push({ kind: 'text', value });
            }
            else if (child.nodeType === 1) {
                out.push({ kind: 'markup', source: inlineSource(child, 0) });
            }
        }
        return out.length > 0 ? out : null;
    };
    const visit = (el, parentStyle, depth, path) => {
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
        // Zero opacity means two different things. An element with a
        // transition or animation on opacity is part-way through being
        // revealed and belongs in the design at full strength; one without
        // is deliberately invisible and is left alone.
        let revealed = false;
        if (parseFloat(computed.opacity) === 0) {
            const motion = `${computed.transition} ${computed.animationName}`;
            revealed = motion.indexOf('opacity') >= 0 || computed.animationName !== 'none';
        }
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
        if (revealed) {
            delete styles['opacity'];
            notes.push({ kind: 'revealed-on-scroll', at: pathOf(el) });
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
        // An inline SVG is almost always an icon, and Scamp keeps svg inner
        // markup verbatim (`svgSource`), so it can come across whole rather
        // than as an empty box. Only the note changes meaning: the shape is
        // preserved, it just isn't editable as elements.
        let svgSource = null;
        if (tag === 'svg') {
            svgSource = el.innerHTML;
            for (const name of ['viewBox', 'fill', 'stroke', 'stroke-width', 'xmlns']) {
                const value = el.getAttribute(name);
                if (value !== null)
                    attrs[name] = value;
            }
            notes.push({ kind: 'svg', at: pathOf(el) });
        }
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
        const inline = inlineContentOf(el);
        const children = [];
        if (inline !== null) {
            // Its children ARE its content; walking them would make boxes of
            // words. `text` stays null — the ordered run carries everything.
            text = null;
        }
        else if (depth >= maxDepth) {
            if (el.children.length > 0) {
                notes.push({ kind: 'depth-capped', at: pathOf(el), detail: String(maxDepth) });
            }
        }
        else if (tag !== 'svg') {
            // An svg's internals are its own language; the element is kept,
            // its children are not walked.
            const siblings = Array.from(el.children);
            siblings.forEach((child, index) => {
                const childPath = `${path}>${child.tagName.toLowerCase()}:${index}`;
                const built = visit(child, computed, depth + 1, childPath);
                if (built)
                    children.push(built);
            });
        }
        const built = { id, tag, styles, text, attrs, children, notes };
        if (svgSource !== null)
            built['svgSource'] = svgSource;
        built['path'] = path;
        if (inline !== null)
            built['inline'] = inline;
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
    const root = visit(rootEl, null, 0, 'body');
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
