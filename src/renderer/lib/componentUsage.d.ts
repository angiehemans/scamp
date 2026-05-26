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
/** Keep only usages whose `propOverrides` map has the named key. */
export declare const filterUsagesWithPropOverride: (usages: ReadonlyArray<InstanceUsage>, propName: string) => InstanceUsage[];
/** Roll up usages into per-page counts in source-page order. */
export declare const groupUsagesByPage: (usages: ReadonlyArray<InstanceUsage>) => Array<{
    pageName: string;
    count: number;
}>;
export {};
