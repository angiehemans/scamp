/**
 * Transient one-line notification anchored under the toolbar.
 * Currently used only for aborted writes during external-edit
 * windows — the indicator going to `paused` is too subtle a signal
 * for the moment Scamp drops a canvas edit. The toast is the
 * dedicated "this just happened" surface.
 *
 * Renders nothing when no toast is set. Auto-dismisses via a timer
 * keyed on the toast id (so a stale timer from a previously-shown
 * toast doesn't clear the current one).
 */
export declare const SaveStatusToast: () => JSX.Element | null;
