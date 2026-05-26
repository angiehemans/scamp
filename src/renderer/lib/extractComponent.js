import { generateCode } from './generateCode';
import { ROOT_ELEMENT_ID } from './element';
/**
 * Lift a subtree into a standalone elements map. Subtree root is
 * renamed to `ROOT_ELEMENT_ID`. see docs/notes/components-data-model.md
 */
export const extractSubtreeAsComponent = (elements, subtreeRootId) => {
    const subtreeRoot = elements[subtreeRootId];
    if (!subtreeRoot)
        return null;
    // Collect every id reachable from the subtree root.
    const idsInSubtree = [];
    const walk = (id) => {
        const el = elements[id];
        if (!el)
            return;
        idsInSubtree.push(id);
        for (const childId of el.childIds)
            walk(childId);
    };
    walk(subtreeRootId);
    const newElements = {};
    for (const id of idsInSubtree) {
        const old = elements[id];
        if (!old)
            continue;
        if (id === subtreeRootId) {
            newElements[ROOT_ELEMENT_ID] = {
                ...old,
                id: ROOT_ELEMENT_ID,
                parentId: null,
                // File name IS the component identity; drop any custom name.
                name: undefined,
            };
        }
        else {
            const newParentId = old.parentId === subtreeRootId ? ROOT_ELEMENT_ID : old.parentId;
            newElements[id] = { ...old, parentId: newParentId };
        }
    }
    return { elements: newElements, rootId: ROOT_ELEMENT_ID };
};
/** Generate component TSX + CSS from a subtree of a page's elements. */
export const generateComponentFromSubtree = (elements, subtreeRootId, componentName, breakpoints) => {
    const extracted = extractSubtreeAsComponent(elements, subtreeRootId);
    if (!extracted)
        return null;
    return generateCode({
        elements: extracted.elements,
        rootId: extracted.rootId,
        pageName: componentName,
        breakpoints,
        cssModuleImportName: componentName,
        isComponent: true,
    });
};
