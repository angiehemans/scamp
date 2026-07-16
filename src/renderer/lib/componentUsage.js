import { parseCode } from './parseCode';
const collectTransitiveComponentNames = (componentTrees, startName, visited) => {
    if (visited.has(startName))
        return;
    visited.add(startName);
    const tree = componentTrees[startName];
    if (!tree)
        return;
    for (const el of Object.values(tree.elements)) {
        if (el.type !== 'component-instance')
            continue;
        const childName = el.componentName;
        if (!childName)
            continue;
        collectTransitiveComponentNames(componentTrees, childName, visited);
    }
};
/** True iff placing `draggedName` inside `targetName` (the active component editor) would form a cycle. */
export const wouldCreateComponentCycle = (componentTrees, targetName, draggedName) => {
    if (!targetName)
        return false;
    if (draggedName === targetName)
        return true;
    const visited = new Set();
    collectTransitiveComponentNames(componentTrees, draggedName, visited);
    return visited.has(targetName);
};
/** Walk every page parsing for instances of `componentName`. */
export const findInstanceUsagesAcrossPages = (pages, componentName) => {
    const out = [];
    for (const page of pages) {
        let parsed;
        try {
            parsed = parseCode(page.tsxContent, page.cssContent);
        }
        catch {
            // Skip malformed pages; warning under-reports rather than throws.
            continue;
        }
        for (const el of Object.values(parsed.elements)) {
            if (el.type !== 'component-instance')
                continue;
            if (el.componentName !== componentName)
                continue;
            out.push({
                pageName: page.name,
                instanceCanvasId: el.id,
                propOverrides: el.propOverrides ?? {},
            });
        }
    }
    return out;
};
/**
 * Instances of `componentName` (across pages) that have page content filling
 * the given slot. Used to warn before a slot is removed or renamed in the
 * component editor: that content stops rendering (it stays in the page file
 * until re-placed). `slotName` is the component-side slot name; the default
 * slot is `children` and matches content carrying no explicit `slotName` tag.
 * see docs/notes/components-multi-file-ops.md
 */
export const findInstancesWithSlotContent = (pages, componentName, slotName) => {
    const out = [];
    for (const page of pages) {
        let parsed;
        try {
            parsed = parseCode(page.tsxContent, page.cssContent);
        }
        catch {
            // Skip malformed pages; warning under-reports rather than throws.
            continue;
        }
        for (const el of Object.values(parsed.elements)) {
            if (el.type !== 'component-instance')
                continue;
            if (el.componentName !== componentName)
                continue;
            const hasContent = el.childIds.some((cid) => {
                const child = parsed.elements[cid];
                if (!child)
                    return false;
                const effective = typeof child.slotName === 'string' && child.slotName.length > 0
                    ? child.slotName
                    : 'children';
                return effective === slotName;
            });
            if (hasContent) {
                out.push({
                    pageName: page.name,
                    instanceCanvasId: el.id,
                    propOverrides: el.propOverrides ?? {},
                });
            }
        }
    }
    return out;
};
/** Keep only usages whose `propOverrides` map has the named key. */
export const filterUsagesWithPropOverride = (usages, propName) => usages.filter((u) => Object.prototype.hasOwnProperty.call(u.propOverrides, propName));
/** Roll up usages into per-page counts in source-page order. */
export const groupUsagesByPage = (usages) => {
    const map = new Map();
    for (const u of usages) {
        map.set(u.pageName, (map.get(u.pageName) ?? 0) + 1);
    }
    return [...map.entries()].map(([pageName, count]) => ({ pageName, count }));
};
