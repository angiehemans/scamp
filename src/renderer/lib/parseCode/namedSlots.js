// Named-slot pre-pass for parseCode. Component instances fill named slots
// with JSX-valued props — `<Card left={<div/>} right={<img/>}>` — which
// htmlparser2 can't tokenize (JSX inside an attribute value). This module
// rewrites those props into ordinary JSX children carrying a
// `data-scamp-slot="<name>"` marker, so the normal structural parse handles
// them; a post-pass then lifts the marker into the element's `slotName`.
// see docs/plans/component-slots-plan.md
/** The attribute the hoist injects onto slot-content elements. Read back
 *  into `slotName` after the structural parse, then dropped from the bag. */
export const SLOT_MARKER_ATTR = 'data-scamp-slot';
/**
 * From `openIdx` (pointing at a `{`), the index of the matching `}`,
 * balancing nested braces and ignoring braces inside string literals.
 * -1 when unbalanced.
 */
const findMatchingBrace = (s, openIdx) => {
    let depth = 0;
    let quote = null;
    for (let i = openIdx; i < s.length; i += 1) {
        const c = s[i];
        if (quote !== null) {
            if (c === quote && s[i - 1] !== '\\')
                quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            quote = c;
            continue;
        }
        if (c === '{')
            depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0)
                return i;
        }
    }
    return -1;
};
/**
 * From `tagOpen` (at `<`), the index of the `>` that closes the OPENING
 * tag, skipping braces/strings so JSX-valued props don't confuse it.
 * -1 when not found.
 */
const findOpeningTagClose = (s, tagOpen) => {
    let i = tagOpen + 1;
    let quote = null;
    let brace = 0;
    while (i < s.length) {
        const c = s[i];
        if (quote !== null) {
            if (c === quote && s[i - 1] !== '\\')
                quote = null;
        }
        else if (c === '"' || c === "'" || c === '`')
            quote = c;
        else if (c === '{')
            brace += 1;
        else if (c === '}')
            brace -= 1;
        else if (brace === 0 && c === '>')
            return i;
        i += 1;
    }
    return -1;
};
/**
 * From `start` (at a `<` opening a JSX element), the index just past the
 * whole element (its `/>` or matching `</tag>`). Tracks nesting; skips
 * braces/strings. Used to walk top-level fragment children.
 */
const skipElement = (s, start) => {
    let i = start;
    let depth = 0;
    while (i < s.length) {
        if (s[i] === '<' && s[i + 1] === '/') {
            const gt = s.indexOf('>', i);
            if (gt < 0)
                return s.length;
            depth -= 1;
            i = gt + 1;
            if (depth === 0)
                return i;
            continue;
        }
        if (s[i] === '<') {
            const gt = findOpeningTagClose(s, i);
            if (gt < 0)
                return s.length;
            const selfClose = s[gt - 1] === '/';
            i = gt + 1;
            if (!selfClose)
                depth += 1;
            if (depth === 0)
                return i;
            continue;
        }
        i += 1;
    }
    return i;
};
/** Inject the slot marker attribute into a single element's opening tag. */
const injectMarker = (element, slotName) => {
    const m = /^\s*<([A-Za-z][A-Za-z0-9]*)/.exec(element);
    if (!m)
        return element;
    const at = element.indexOf(m[1]) + m[1].length;
    return `${element.slice(0, at)} ${SLOT_MARKER_ATTR}="${slotName}"${element.slice(at)}`;
};
/**
 * Turn a named-slot JSX value into marker-carrying JSX. A single element
 * gets the marker injected; a `<>…</>` fragment has each top-level element
 * marked (all belong to the same slot) and the fragment wrapper dropped.
 */
const markSlotValue = (jsx, slotName) => {
    const trimmed = jsx.trim();
    if (!trimmed.startsWith('<>'))
        return injectMarker(trimmed, slotName);
    const closeIdx = trimmed.lastIndexOf('</>');
    const inner = trimmed.slice(2, closeIdx);
    let out = '';
    let i = 0;
    while (i < inner.length) {
        if (inner[i] === '<' && inner[i + 1] !== '/') {
            const end = skipElement(inner, i);
            out += injectMarker(inner.slice(i, end), slotName);
            i = end;
        }
        else {
            out += inner[i];
            i += 1;
        }
    }
    return out;
};
/**
 * Pull the named-slot props out of one instance's opening-tag text
 * (`<Card … left={<…>} …>` or `… />`). Returns the tag with those props
 * removed and the marked children to nest inside the instance.
 */
const extractNamedSlotsFromTag = (openTag) => {
    const attrRe = /\b([a-z][a-zA-Z0-9]*)\s*=\s*\{\s*</g;
    const removals = [];
    let children = '';
    for (let m = attrRe.exec(openTag); m !== null; m = attrRe.exec(openTag)) {
        const braceIdx = openTag.indexOf('{', m.index);
        const closeBrace = findMatchingBrace(openTag, braceIdx);
        if (closeBrace < 0)
            continue;
        const jsx = openTag.slice(braceIdx + 1, closeBrace);
        children += markSlotValue(jsx, m[1]);
        removals.push({ start: m.index, end: closeBrace + 1 });
        attrRe.lastIndex = closeBrace + 1;
    }
    let strippedOpen = openTag;
    for (let r = removals.length - 1; r >= 0; r -= 1) {
        const { start, end } = removals[r];
        let s = start;
        while (s > 0 && /\s/.test(strippedOpen[s - 1]))
            s -= 1;
        strippedOpen = strippedOpen.slice(0, s) + strippedOpen.slice(end);
    }
    return { strippedOpen, markedChildren: children };
};
/**
 * Rewrite every component-instance's named-slot props into
 * marker-carrying JSX children. Instances are located by
 * `data-scamp-instance-id`; a named-slot prop is any `name={<…>}` attribute
 * on the opening tag. String props (`label="x"`) and non-element braced
 * props (`className={styles.x}`) are left untouched.
 */
export const hoistNamedSlots = (tsx) => {
    const idRe = /data-scamp-instance-id\s*=\s*"/g;
    const edits = [];
    for (let m = idRe.exec(tsx); m !== null; m = idRe.exec(tsx)) {
        const tagOpen = tsx.lastIndexOf('<', m.index);
        if (tagOpen < 0)
            continue;
        const tagCloseGt = findOpeningTagClose(tsx, tagOpen);
        if (tagCloseGt < 0)
            continue;
        idRe.lastIndex = tagCloseGt;
        const openTag = tsx.slice(tagOpen, tagCloseGt + 1);
        const { strippedOpen, markedChildren } = extractNamedSlotsFromTag(openTag);
        if (markedChildren.length === 0)
            continue;
        const tagName = /^<([A-Za-z][A-Za-z0-9]*)/.exec(openTag)?.[1] ?? '';
        const selfClose = /\/>\s*$/.test(openTag);
        const replacement = selfClose
            ? `${strippedOpen.replace(/\s*\/>\s*$/, '>')}${markedChildren}</${tagName}>`
            : `${strippedOpen}${markedChildren}`;
        edits.push({ tagOpen, tagCloseGt, replacement });
    }
    if (edits.length === 0)
        return tsx;
    let result = tsx;
    for (let e = edits.length - 1; e >= 0; e -= 1) {
        const { tagOpen, tagCloseGt, replacement } = edits[e];
        result = result.slice(0, tagOpen) + replacement + result.slice(tagCloseGt + 1);
    }
    return result;
};
