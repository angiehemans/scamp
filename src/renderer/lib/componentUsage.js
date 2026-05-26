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
