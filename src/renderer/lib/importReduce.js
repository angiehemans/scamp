import { CAPTURE_VERSION, } from '@shared/importCapture';
import { ROOT_ELEMENT_ID } from './element';
import { makeBaseline, applyDeclarations } from './parseCode/apply';
/**
 * Tags that become a text element. Mirrors `parseCode`'s own list —
 * a text element is one whose content is words rather than layout.
 */
const TEXT_TAGS = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label',
    'blockquote', 'pre', 'code', 'strong', 'em', 'small', 'time',
    'figcaption', 'legend', 'li', 'button', 'th', 'td', 'caption',
]);
const IMAGE_TAGS = new Set(['img', 'video', 'iframe', 'svg']);
const INPUT_TAGS = new Set(['input', 'textarea', 'select']);
/**
 * A property that, present on a node, means the node is doing something
 * visible and must not be collapsed away.
 */
const VISUAL_PROPERTIES = [
    'background-color', 'background-image', 'opacity', 'box-shadow', 'filter',
    'backdrop-filter', 'mix-blend-mode', 'transform',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'position', 'z-index', 'overflow-x', 'overflow-y',
    'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
];
/** A display value that means the node is arranging its children. */
const LAYOUT_DISPLAYS = new Set([
    'flex', 'inline-flex', 'grid', 'inline-grid',
]);
/** Displays with no equivalent in the model, kept verbatim but reported. */
const UNSUPPORTED_DISPLAYS = new Set([
    'table', 'table-row', 'table-cell', 'table-header-group',
    'table-row-group', 'table-footer-group', 'list-item', 'contents',
]);
const elementTypeFor = (tag) => {
    if (IMAGE_TAGS.has(tag))
        return 'image';
    if (INPUT_TAGS.has(tag))
        return 'input';
    return TEXT_TAGS.has(tag) ? 'text' : 'rectangle';
};
/** Does this node make a visible difference beyond holding its children? */
const isVisuallyMeaningful = (node) => {
    if (VISUAL_PROPERTIES.some((p) => p in node.styles))
        return true;
    if (LAYOUT_DISPLAYS.has(node.styles['display'] ?? ''))
        return true;
    if (node.text !== null)
        return true;
    if (Object.keys(node.attrs).length > 0)
        return true;
    if (node.notes.length > 0)
        return true;
    return false;
};
/**
 * Remove wrappers that hold exactly one child and decide nothing.
 *
 * Conservative by choice: one child only, and only when the node has no
 * visual property, no layout display, no text, no attributes and no
 * notes. A wrapper that centres its child with flex is doing real work
 * and stays, even though it looks redundant in the layers panel.
 */
const collapse = (node, findings, path, 
/** The view's root is never collapsed away: the tree has to have one. */
isRoot = false) => {
    const here = [...path, node.tag];
    let current = {
        ...node,
        children: node.children.map((c) => collapse(c, findings, here)),
    };
    if (isRoot)
        return current;
    while (current.children.length === 1 &&
        !isVisuallyMeaningful(current) &&
        current.tag === 'div') {
        const only = current.children[0];
        if (only === undefined)
            break;
        findings.push({
            kind: 'collapsed-wrapper',
            at: here.join(' > '),
            detail: `<div> around <${only.tag}>`,
        });
        current = only;
    }
    return current;
};
/**
 * Drop a size that the layout produced rather than the author chose.
 *
 * A node with element children is sized by its content and its parent;
 * pinning the measured pixels is how an import turns into a rigid
 * screenshot. A leaf keeps its size, because an image or a spacer with
 * an explicit box is usually the point.
 *
 * This is the conservative reading. The precise answer needs the
 * authored rules rather than the computed ones, which is a phase-2
 * question — see the plan's note on `document.styleSheets`.
 */
const dropComputedSizes = (styles, hasChildren, findings, at) => {
    if (!hasChildren)
        return { styles, dropped: [] };
    const next = { ...styles };
    const dropped = [];
    for (const prop of ['width', 'height']) {
        if (!(prop in next))
            continue;
        findings.push({ kind: 'dropped-computed-size', at, detail: `${prop}: ${next[prop]}` });
        delete next[prop];
        dropped.push(prop);
    }
    return { styles: next, dropped };
};
/** `styles` as the declaration list `applyDeclarations` expects. */
const toDeclarations = (styles) => Object.entries(styles).map(([prop, value]) => ({ prop, value }));
/**
 * A readable class prefix from the tag and its role, so the layers
 * panel reads like a design rather than a DOM dump.
 */
const NAME_FOR_TAG = {
    nav: 'nav', header: 'header', footer: 'footer', main: 'main',
    section: 'section', article: 'card', aside: 'aside', figure: 'figure',
    ul: 'list', ol: 'list', li: 'item', img: 'image', button: 'button',
    a: 'link', h1: 'title', h2: 'heading', h3: 'subheading',
    p: 'text', span: 'label', form: 'form', input: 'field',
};
/** PascalCase view name from a page title, falling back to `Imported`. */
export const viewNameFromTitle = (title) => {
    const words = title
        .replace(/[^A-Za-z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .slice(0, 3);
    if (words.length === 0)
        return 'Imported';
    const name = words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    return /^[0-9]/.test(name) ? `Imported${name}` : name;
};
/** Reduce a captured page to an element tree. Pure. */
export const reduceCapture = (payload, options = {}) => {
    if (payload.version !== CAPTURE_VERSION) {
        throw new Error(`Capture payload is version ${payload.version}; this build reads ${CAPTURE_VERSION}.`);
    }
    const findings = [];
    // Capture's own notes come first: they describe the source page, and
    // they are the things Scamp cannot represent at all.
    const collectNotes = (node) => {
        for (const note of node.notes)
            findings.push({ ...note });
        node.children.forEach(collectNotes);
    };
    collectNotes(payload.root);
    for (const note of payload.notes)
        findings.push({ ...note });
    const pruned = collapse(payload.root, findings, [], true);
    let counter = 0;
    const fallbackId = () => {
        counter += 1;
        return counter.toString(16).padStart(4, '0');
    };
    const nextId = options.randomId ?? fallbackId;
    const elements = {};
    const used = new Set([ROOT_ELEMENT_ID]);
    const build = (node, parentId, path, parentIsLayout) => {
        const isRoot = parentId === null;
        const type = elementTypeFor(node.tag);
        const at = [...path, node.tag].join(' > ');
        let id = ROOT_ELEMENT_ID;
        if (!isRoot) {
            do {
                id = nextId();
            } while (used.has(id));
            used.add(id);
        }
        const name = isRoot ? null : (NAME_FOR_TAG[node.tag] ?? 'box');
        const className = isRoot ? ROOT_ELEMENT_ID : `${name}_${id}`;
        // Scamp's rule: words live in a text element, never loose in a
        // container. A node with both text and element children gets the
        // text lifted into a child of its own.
        const hasElementChildren = node.children.length > 0;
        const needsTextChild = node.text !== null && hasElementChildren;
        const sized = dropComputedSizes(node.styles, hasElementChildren, findings, at);
        const styles = sized.styles;
        const display = styles['display'];
        if (display !== undefined && UNSUPPORTED_DISPLAYS.has(display)) {
            findings.push({ kind: 'unsupported-display', at, detail: display });
        }
        const raw = {
            id,
            type,
            // `document.body` is the capture's root; a Scamp root is a div.
            tag: isRoot ? 'div' : node.tag,
            className,
            parentId,
            childIds: [],
            text: needsTextChild ? null : node.text,
            inlineFragments: [],
            name,
            src: type === 'image' && node.tag === 'img' ? (node.attrs['src'] ?? null) : null,
            alt: type === 'image' && node.tag === 'img' ? (node.attrs['alt'] ?? '') : null,
            attributes: Object.fromEntries(Object.entries(node.attrs).filter(([k]) => !(type === 'image' && node.tag === 'img' && (k === 'src' || k === 'alt')))),
            svgSource: null,
            selectOptions: null,
            componentName: null,
            instanceId: null,
            propOverrides: null,
            missingComponent: false,
            bind: null,
            on: null,
            repeat: null,
            showIf: null,
            range: null,
        };
        const baseline = makeBaseline(raw, true);
        const element = applyDeclarations(baseline, toDeclarations(styles), parentIsLayout);
        // A size that was a layout result becomes "auto", not the model's
        // 100px placeholder — deleting the declaration alone would emit a
        // hardcoded box no one asked for.
        const autoSized = {};
        if (sized.dropped.includes('width'))
            autoSized.widthMode = 'auto';
        if (sized.dropped.includes('height'))
            autoSized.heightMode = 'auto';
        const selfIsLayoutForText = LAYOUT_DISPLAYS.has(display ?? '');
        const childIds = [];
        if (needsTextChild) {
            const textId = (() => {
                let candidate = nextId();
                while (used.has(candidate))
                    candidate = nextId();
                used.add(candidate);
                return candidate;
            })();
            findings.push({ kind: 'wrapped-bare-text', at, detail: node.text ?? '' });
            const textRaw = {
                ...raw,
                id: textId,
                type: 'text',
                tag: 'span',
                className: `text_${textId}`,
                parentId: id,
                name: 'text',
                text: node.text,
                src: null,
                alt: null,
                attributes: {},
            };
            elements[textId] = applyDeclarations(makeBaseline(textRaw, true), [], selfIsLayoutForText);
            childIds.push(textId);
        }
        const selfIsLayout = LAYOUT_DISPLAYS.has(display ?? '');
        for (const child of node.children) {
            childIds.push(build(child, id, [...path, node.tag], selfIsLayout));
        }
        elements[id] = { ...element, ...autoSized, childIds };
        return id;
    };
    build(pruned, null, [], false);
    return {
        elements,
        rootId: ROOT_ELEMENT_ID,
        findings,
        suggestedName: viewNameFromTitle(payload.title),
    };
};
