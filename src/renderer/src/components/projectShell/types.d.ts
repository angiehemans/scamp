/**
 * The component currently being edited, when the canvas is in the
 * component editor instead of the page editor. Mutually exclusive with
 * the active page. `returnToPage` records which page (if any) the user
 * entered from so Esc / breadcrumb-click returns them there.
 */
export type ActiveComponent = {
    name: string;
    returnToPage: string | null;
};
/** Per-page impact summary used in the multi-instance confirm dialogs. */
export type PageImpact = {
    pageName: string;
    count: number;
};
/** Queued lock-prop-with-overrides confirmation. */
export type LockPropRequest = {
    elementId: string;
    propName: string;
    impactByPage: ReadonlyArray<PageImpact>;
};
/** Queued delete-prop-text-with-overrides confirmation. */
export type DeletePropTextRequest = {
    elementIds: ReadonlyArray<string>;
    propsAtRisk: ReadonlyArray<string>;
    impactByPage: ReadonlyArray<PageImpact>;
};
/** Queued detach-instance confirmation. */
export type DetachRequest = {
    instanceId: string;
    componentName: string;
    overrideCount: number;
};
/** Queued delete-component confirmation. */
export type DeletingComponent = {
    componentName: string;
    impactByPage: ReadonlyArray<PageImpact>;
};
/** Right-click context-menu anchor for a page or component sidebar row. */
export type SidebarMenu<K extends string> = {
    x: number;
    y: number;
} & {
    [P in K]: string;
};
export type PageMenuState = {
    x: number;
    y: number;
    pageName: string;
};
export type ComponentMenuState = {
    x: number;
    y: number;
    componentName: string;
};
/** Pages-sidebar inline-edit state. */
export type PageEdit = 'new' | {
    duplicate: string;
} | {
    rename: string;
} | null;
/** Components-sidebar inline-edit state. */
export type ComponentEdit = 'new' | {
    rename: string;
} | null;
