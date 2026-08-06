import { classNameFor, elementDeclarationLines, tagFor } from './generateCode';
/** Longest text preview shown for a child, before an ellipsis. */
export const TEXT_PREVIEW_MAX = 40;
export const previewText = (raw) => {
    const flat = raw.replace(/\s+/g, ' ').trim();
    return flat.length > TEXT_PREVIEW_MAX
        ? `${flat.slice(0, TEXT_PREVIEW_MAX - 1)}…`
        : flat;
};
/**
 * `prop: value;` → `[prop, value]`, skipping anything malformed.
 *
 * Lives here rather than in a renderer because two of them need it and a
 * third (MCP) reports the map directly — the same reason the model exists.
 */
export const parseDeclarations = (lines) => {
    const out = new Map();
    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon < 1)
            continue;
        const prop = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).replace(/;$/, '').trim();
        if (prop.length > 0 && value.length > 0)
            out.set(prop, value);
    }
    return out;
};
/** Ancestors, outermost first. */
const parentChain = (elements, el) => {
    const chain = [];
    let cursor = el.parentId ? elements[el.parentId] : undefined;
    // Bounded by the map size so a corrupt parent cycle can't hang a caller.
    let guard = Object.keys(elements).length + 1;
    while (cursor && guard > 0) {
        chain.unshift(`.${classNameFor(cursor)}`);
        cursor = cursor.parentId ? elements[cursor.parentId] : undefined;
        guard -= 1;
    }
    return chain;
};
const describeChild = (child) => {
    const common = {
        className: classNameFor(child),
        tag: tagFor(child),
        childCount: child.childIds.length,
    };
    if (child.type === 'text' && typeof child.text === 'string' && child.text.length > 0) {
        return { ...common, kind: 'text', text: previewText(child.text) };
    }
    if (child.type === 'component-instance') {
        return {
            ...common,
            kind: 'instance',
            componentName: child.componentName ?? 'unknown component',
        };
    }
    return { ...common, kind: child.childIds.length > 0 ? 'container' : 'leaf' };
};
const describeElement = (elements, el) => {
    const parent = el.parentId ? elements[el.parentId] : undefined;
    // The generator's own emitter, so descriptions can't drift from the CSS
    // actually on disk. It appends customProperties, so filter those back out
    // — they're reported separately, since they aren't canvas-controllable.
    const custom = Object.entries(el.customProperties ?? {});
    const customProps = new Set(custom.map(([prop]) => prop));
    const declarations = elementDeclarationLines(el, parent ?? null).filter((line) => {
        if (line.length === 0)
            return false;
        const prop = line.slice(0, line.indexOf(':')).trim();
        return !customProps.has(prop);
    });
    return {
        id: el.id,
        className: classNameFor(el),
        tag: tagFor(el),
        ...(el.name !== undefined && el.name.length > 0 ? { name: el.name } : {}),
        ...(parent ? { parentClassName: classNameFor(parent) } : {}),
        chain: parentChain(elements, el),
        declarations,
        styles: Object.fromEntries(parseDeclarations(declarations)),
        customProperties: custom,
        children: el.childIds
            .map((id) => elements[id])
            .filter((c) => c !== undefined)
            .map(describeChild),
    };
};
export const buildContextModel = (input) => {
    const { target, elements, selectedIds, canvasWidth, breakpointLabel } = input;
    const primaryId = selectedIds[0];
    const selected = primaryId !== undefined ? elements[primaryId] : undefined;
    // Excludes the root: "elements on the canvas" means what the user drew,
    // not the page frame they drew it on.
    const elementCount = Object.values(elements).filter((el) => el.parentId !== null).length;
    return {
        target,
        element: selected === undefined ? null : describeElement(elements, selected),
        extraSelected: Math.max(0, selectedIds.length - 1),
        elementCount,
        canvasWidth,
        breakpointLabel,
    };
};
