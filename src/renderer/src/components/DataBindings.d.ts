import type { ScampElement } from '@lib/element';
/** A name no prop uses yet: `base`, then `base2`, `base3`, … */
export declare const freePropName: (base: string, taken: ReadonlyArray<string>) => string;
/**
 * Does this element have anything the Data tab can say about it? Used
 * to decide whether selecting it is worth narrowing the tab to — an
 * element with nothing to bind would leave an empty panel.
 */
export declare const hasBindableData: (el: ScampElement) => boolean;
type BindingSectionsProps = {
    /** Show only this element's bindings. Null shows every element's. */
    onlyElementId?: string | null;
};
export declare const BindingSections: ({ onlyElementId, }?: BindingSectionsProps) => JSX.Element | null;
export {};
