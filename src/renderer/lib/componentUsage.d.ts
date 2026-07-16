import type { ScampElement } from './element';
import type { PageFile } from '@shared/types';
type ComponentTree = {
    elements: Record<string, ScampElement>;
    rootId: string;
};
/** True iff placing `draggedName` inside `targetName` (the active component editor) would form a cycle. */
export declare const wouldCreateComponentCycle: (componentTrees: Record<string, ComponentTree>, targetName: string | null, draggedName: string) => boolean;
export type InstanceUsage = {
    pageName: string;
    instanceCanvasId: string;
    propOverrides: Record<string, string>;
};
/** Walk every page parsing for instances of `componentName`. */
export declare const findInstanceUsagesAcrossPages: (pages: ReadonlyArray<PageFile>, componentName: string) => InstanceUsage[];
/**
 * Instances of `componentName` (across pages) that have page content filling
 * the given slot. Used to warn before a slot is removed or renamed in the
 * component editor: that content stops rendering (it stays in the page file
 * until re-placed). `slotName` is the component-side slot name; the default
 * slot is `children` and matches content carrying no explicit `slotName` tag.
 * see docs/notes/components-multi-file-ops.md
 */
export declare const findInstancesWithSlotContent: (pages: ReadonlyArray<PageFile>, componentName: string, slotName: string) => InstanceUsage[];
/** Keep only usages whose `propOverrides` map has the named key. */
export declare const filterUsagesWithPropOverride: (usages: ReadonlyArray<InstanceUsage>, propName: string) => InstanceUsage[];
/** Roll up usages into per-page counts in source-page order. */
export declare const groupUsagesByPage: (usages: ReadonlyArray<InstanceUsage>) => Array<{
    pageName: string;
    count: number;
}>;
export {};
