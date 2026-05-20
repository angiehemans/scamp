import type { ScampElement } from './element';
import type { PageFile } from '@shared/types';
/**
 * The parsed component-tree shape held in
 * `canvasStore.componentTrees`. Re-declared here (rather than
 * imported from the store) so this lib file doesn't take a store
 * dependency — keeps it pure and trivially testable.
 */
type ComponentTree = {
    elements: Record<string, ScampElement>;
    rootId: string;
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
export declare const wouldCreateComponentCycle: (componentTrees: Record<string, ComponentTree>, targetName: string | null, draggedName: string) => boolean;
/**
 * One use of a component on a page. Captured by parsing every
 * page's TSX/CSS in `findInstanceUsagesAcrossPages` and walking
 * the result for matching `component-instance` elements.
 *
 * `propOverrides` is the parsed override map for THIS instance.
 * Empty when the JSX tag has no extra attributes beyond
 * `data-scamp-instance-id`. Used by the lock-prop /
 * delete-prop-text warnings to enumerate the values a destructive
 * action would silently invalidate.
 */
export type InstanceUsage = {
    pageName: string;
    instanceCanvasId: string;
    propOverrides: Record<string, string>;
};
/**
 * Find every instance of `componentName` across the project's
 * pages. Pure-renderer: we already have the TSX/CSS content of
 * every page in `project.pages`, so this needs no IPC round-trip.
 *
 * Used by Phase 7 warnings to compute "this many places will be
 * affected" before a destructive action commits.
 */
export declare const findInstanceUsagesAcrossPages: (pages: ReadonlyArray<PageFile>, componentName: string) => InstanceUsage[];
/**
 * Filter the result of `findInstanceUsagesAcrossPages` down to
 * just the instances that currently have an override for the
 * given prop name. Convenience used by the lock-prop +
 * delete-prop-text warnings to count "instances that would
 * lose data".
 */
export declare const filterUsagesWithPropOverride: (usages: ReadonlyArray<InstanceUsage>, propName: string) => InstanceUsage[];
/**
 * Roll up usages into a per-page count for ConfirmDialog impact
 * messages. Returned in the same order pages appear in the
 * source array.
 */
export declare const groupUsagesByPage: (usages: ReadonlyArray<InstanceUsage>) => Array<{
    pageName: string;
    count: number;
}>;
export {};
