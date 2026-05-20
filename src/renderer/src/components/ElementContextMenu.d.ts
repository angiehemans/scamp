/**
 * Custom event the menu dispatches when the user picks "Create
 * component" on a non-root, non-instance element. `ProjectShell`
 * listens for it, opens the name-input dialog, and on confirm
 * runs the convert-to-component flow.
 */
export declare const CONVERT_TO_COMPONENT_EVENT = "scamp:convert-to-component";
export type ConvertToComponentEventDetail = {
    elementId: string;
};
/**
 * Custom event for the Phase 8 "Detach from component" action.
 * Fired by the right-click menu when the target element is a
 * component-instance. `ProjectShell` listens, surfaces a one-way
 * ConfirmDialog (with an override-impact note if any overrides
 * are set), and on confirm runs `detachInstance`.
 */
export declare const DETACH_INSTANCE_EVENT = "scamp:detach-instance";
export type DetachInstanceEventDetail = {
    instanceId: string;
};
/**
 * Single-instance context menu for canvas elements. Listens for the
 * `scamp:open-element-context-menu` custom event dispatched by
 * `ElementRenderer.onContextMenu`, opens at the supplied coordinates,
 * dismisses on outside click / Escape (handled by the underlying
 * `PageContextMenu` primitive).
 *
 * Currently exposes a single "Export…" item that scrolls the
 * Export section into view. Future menu entries (Copy, Duplicate,
 * Delete, Bring to Front …) plug in here.
 */
export declare const ElementContextMenu: () => JSX.Element | null;
