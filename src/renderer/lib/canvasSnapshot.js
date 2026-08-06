import { buildContextModel, } from './contextModel';
import { classNameFor, tagFor } from './generateCode';
/**
 * Ceiling on elements returned by `get_canvas_state`.
 *
 * The whole map on a busy page runs to tens of kilobytes, and it lands
 * directly in the agent's context window. Agents reach for the broadest tool
 * first, so an uncapped version would be the expensive default rather than
 * the considered choice. A truncated answer that SAYS it was truncated beats
 * both an unbounded one and no tool at all.
 */
export const CANVAS_STATE_ELEMENT_LIMIT = 200;
/**
 * Project-relative POSIX paths for a page.
 *
 * Mirrors `main/ipc/pageOps.ts` → `pagePathsFor`, which is the source of
 * truth for where pages live. Duplicated rather than imported because that
 * one builds ABSOLUTE paths with `path.join` — backslashes on Windows, and a
 * leaked home directory in text an agent will quote back.
 */
export const pagePathsRelative = (pageName, format) => {
    if (format === 'legacy') {
        return { tsx: `${pageName}.tsx`, css: `${pageName}.module.css` };
    }
    if (pageName === 'home') {
        return { tsx: 'app/page.tsx', css: 'app/page.module.css' };
    }
    return {
        tsx: `app/${pageName}/page.tsx`,
        css: `app/${pageName}/page.module.css`,
    };
};
/** Mirrors `main/ipc/componentOps.ts` → `componentPathsFor`. */
export const componentPathsRelative = (name) => ({
    tsx: `components/${name}/${name}.tsx`,
    css: `components/${name}/${name}.module.css`,
});
/** `ContextElement` → the tool's element shape. */
const toElementResult = (el, source) => ({
    id: el.id,
    class: el.className,
    tag: el.tag,
    ...(el.name !== undefined ? { name: el.name } : {}),
    parentId: source.parentId,
    childIds: [...source.childIds],
    styles: el.styles,
    customProperties: Object.fromEntries(el.customProperties),
});
/**
 * Describe one element by id, via the shared model.
 *
 * Routing through `buildContextModel` rather than reading the element
 * directly is deliberate: it's what guarantees the MCP answer and the context
 * file report the same declarations, including the custom-property split.
 */
const describeById = (input, id) => {
    const source = input.elements[id];
    if (source === undefined)
        return null;
    const model = buildContextModel({
        target: input.target,
        elements: input.elements,
        selectedIds: [id],
        canvasWidth: input.canvasWidth,
        breakpointLabel: input.breakpointLabel,
    });
    return model.element === null ? null : toElementResult(model.element, source);
};
export const getActiveTarget = (input) => {
    const { target } = input;
    if (target === null)
        return null;
    return {
        kind: target.kind,
        name: target.name,
        tsx: target.tsxPath,
        css: target.cssPath,
    };
};
export const getSelectedElement = (input) => {
    const primary = input.selectedIds[0];
    return primary === undefined ? null : describeById(input, primary);
};
export const getElementById = (input, id) => describeById(input, id);
/**
 * The tree, ids and tags only.
 *
 * Deliberately style-free — this is the cheap structural tool an agent uses
 * to orient before pulling detail with `get_element_by_id`. Adding styles
 * here would make it another `get_canvas_state`.
 */
export const getElementTree = (input) => {
    const root = input.elements[input.rootElementId];
    if (root === undefined)
        return null;
    // Iterative with a seen-set: a corrupt parent/child cycle would otherwise
    // recurse until the stack blows, and this runs on live in-memory state
    // that an external edit may have just reshaped.
    const seen = new Set();
    const build = (el) => {
        seen.add(el.id);
        const children = [];
        for (const childId of el.childIds) {
            if (seen.has(childId))
                continue;
            const child = input.elements[childId];
            if (child !== undefined)
                children.push(build(child));
        }
        return { id: el.id, class: classNameFor(el), tag: tagFor(el), children };
    };
    return { root: build(root) };
};
export const listPages = (input) => input.pageNames.map((name) => ({
    name,
    ...pagePathsRelative(name, input.projectFormat),
}));
/**
 * Components by name and path.
 *
 * No `variants` field: variants aren't on `main` yet, and a field an agent is
 * told to expect but always finds empty reads as "this component has none".
 * Adding it later is additive.
 */
export const listComponents = (input) => input.componentNames.map((name) => ({
    name,
    ...componentPathsRelative(name),
}));
/**
 * Theme tokens exactly as they sit in `theme.css` — a flat list, not grouped
 * into colours / typography / spacing.
 *
 * The agent reading this is usually about to EDIT that file. Inventing a
 * structure the file doesn't have would leave it editing against the wrong
 * shape, and the grouping would have to be guessed from name prefixes, which
 * breaks silently the first time a token is named unconventionally.
 */
export const getThemeTokens = (input) => ({
    tokens: input.themeTokens.map(({ name, value }) => ({ name, value })),
    themes: input.themes.map(({ id, label }) => ({ id, label })),
    activeThemeId: input.activeThemeId,
});
/**
 * Map an MCP tool name onto its snapshot function.
 *
 * Lives here rather than in the renderer's IPC responder so the whole tool
 * surface is testable without a window — the responder becomes "read store,
 * call this, reply".
 *
 * Throws on an unknown name: the protocol layer has already checked it, so
 * reaching here means the two lists have drifted, and a thrown error surfaces
 * that as an `isError` result rather than a confusing `null`.
 */
export const answerSnapshotTool = (tool, args, input) => {
    switch (tool) {
        case 'scamp_get_active_page':
            return getActiveTarget(input);
        case 'scamp_get_selected_element':
            return getSelectedElement(input);
        case 'scamp_get_element_by_id':
            return getElementById(input, String(args['id'] ?? ''));
        case 'scamp_get_element_tree':
            return getElementTree(input);
        case 'scamp_get_canvas_state':
            return getCanvasState(input);
        case 'scamp_list_pages':
            return listPages(input);
        case 'scamp_list_components':
            return listComponents(input);
        case 'scamp_get_theme_tokens':
            return getThemeTokens(input);
        default:
            throw new Error(`Unknown snapshot tool: ${tool}`);
    }
};
export const getCanvasState = (input) => {
    const ids = Object.keys(input.elements);
    const kept = ids.slice(0, CANVAS_STATE_ELEMENT_LIMIT);
    const elements = {};
    for (const id of kept) {
        const described = describeById(input, id);
        if (described !== null)
            elements[id] = described;
    }
    return {
        active: getActiveTarget(input),
        selectedElementId: input.selectedIds[0] ?? null,
        breakpoint: {
            id: input.breakpointId,
            label: input.breakpointLabel,
            width: input.canvasWidth,
        },
        elements,
        ...(ids.length > kept.length
            ? {
                truncated: {
                    returned: kept.length,
                    total: ids.length,
                    hint: `Only the first ${kept.length} of ${ids.length} elements are included. Use scamp_get_element_tree for the full structure and scamp_get_element_by_id for the rest.`,
                },
            }
            : {}),
    };
};
