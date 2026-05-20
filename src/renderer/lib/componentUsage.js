import { parseCode } from './parseCode';
/**
 * Walk the named component's tree (and every nested component
 * via `componentTrees`) collecting every component name it
 * transitively contains. Used by cycle detection at drop time.
 *
 * `visited` is threaded through recursive calls so a malformed
 * project state with an existing cycle doesn't infinite-loop the
 * walker. Cycles in the input would be the bug we're preventing,
 * but defensive bookkeeping costs nothing.
 */
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
/**
 * Refuse-or-allow check for "place component `draggedName`
 * inside the canvas of `targetName`." Returns true when the
 * placement would form a cycle, false otherwise.
 *
 * Cycles take three shapes:
 *   - direct: dropping a component into its own editor
 *     (`draggedName === targetName`)
 *   - one-hop: dragged already contains the target somewhere
 *   - transitive: dragged → other → target via nested instances
 *
 * `componentTrees` is the renderer's parsed-on-open cache;
 * passing it explicitly keeps this helper a pure function.
 */
export const wouldCreateComponentCycle = (componentTrees, targetName, draggedName) => {
    // No active component editor → we're dropping onto a page, no
    // cycle is structurally possible.
    if (!targetName)
        return false;
    if (draggedName === targetName)
        return true;
    const visited = new Set();
    collectTransitiveComponentNames(componentTrees, draggedName, visited);
    return visited.has(targetName);
};
/**
 * Find every instance of `componentName` across the project's
 * pages. Pure-renderer: we already have the TSX/CSS content of
 * every page in `project.pages`, so this needs no IPC round-trip.
 *
 * Used by Phase 7 warnings to compute "this many places will be
 * affected" before a destructive action commits.
 */
export const findInstanceUsagesAcrossPages = (pages, componentName) => {
    const out = [];
    for (const page of pages) {
        let parsed;
        try {
            parsed = parseCode(page.tsxContent, page.cssContent);
        }
        catch {
            // A malformed page would throw; skip it rather than blow
            // up the impact computation. Worst case the warning
            // under-reports — better than masking the user's
            // destructive action behind a parse error.
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
 * Filter the result of `findInstanceUsagesAcrossPages` down to
 * just the instances that currently have an override for the
 * given prop name. Convenience used by the lock-prop +
 * delete-prop-text warnings to count "instances that would
 * lose data".
 */
export const filterUsagesWithPropOverride = (usages, propName) => usages.filter((u) => Object.prototype.hasOwnProperty.call(u.propOverrides, propName));
/**
 * Roll up usages into a per-page count for ConfirmDialog impact
 * messages. Returned in the same order pages appear in the
 * source array.
 */
export const groupUsagesByPage = (usages) => {
    const map = new Map();
    for (const u of usages) {
        map.set(u.pageName, (map.get(u.pageName) ?? 0) + 1);
    }
    return [...map.entries()].map(([pageName, count]) => ({ pageName, count }));
};
