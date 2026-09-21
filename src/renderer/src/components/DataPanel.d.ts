/** Prop→Locked toggle dispatch; ProjectShell decides whether to warn. */
export declare const REQUEST_LOCK_PROP_EVENT = "scamp:request-lock-prop";
export type RequestLockPropEventDetail = {
    elementId: string;
    componentName: string;
    propName: string;
};
export declare const DataPanel: () => JSX.Element;
/**
 * The open view's data as a section of the properties panel's empty
 * state, beside Routes: its props, slots, repeats, show flags, bound
 * attributes, and events. Page-level, like a route, which is why it
 * doesn't wait for a selection. see docs/notes/routes-in-the-app.md
 */
/**
 * How many props the open view declares — what the Data section's
 * header shows, so a collapsed section still says whether there is
 * anything in it. Counts every kind: text, attribute, boolean,
 * repeat, show, event, slot.
 */
export declare const useViewDataCount: () => number;
export declare const ViewDataSection: () => JSX.Element;
