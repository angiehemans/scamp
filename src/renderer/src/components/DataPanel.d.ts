/** Prop→Locked toggle dispatch; ProjectShell decides whether to warn. */
export declare const REQUEST_LOCK_PROP_EVENT = "scamp:request-lock-prop";
export type RequestLockPropEventDetail = {
    elementId: string;
    componentName: string;
    propName: string;
};
export declare const DataPanel: () => JSX.Element;
