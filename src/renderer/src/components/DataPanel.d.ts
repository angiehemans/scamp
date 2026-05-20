/**
 * Phase 7 hook: when the user toggles a prop-text element from
 * Prop → Locked, DataPanel dispatches this event instead of
 * calling `togglePropOnText` directly. `ProjectShell` listens,
 * walks every page to find instances with an override for the
 * named prop, and either runs the toggle silently (no overrides
 * at risk) or surfaces a ConfirmDialog with the impact info.
 */
export declare const REQUEST_LOCK_PROP_EVENT = "scamp:request-lock-prop";
export type RequestLockPropEventDetail = {
    elementId: string;
    componentName: string;
    propName: string;
};
/**
 * Top-level Data tab. Branches between the component-editor view
 * (Phase 5: declare props) and the instance-selected-on-page view
 * (Phase 6: override per-instance values).
 */
export declare const DataPanel: () => JSX.Element;
