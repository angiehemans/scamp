/**
 * Header indicator showing whether canvas edits are in sync with disk.
 * Driven by `useSaveStatusStore`, which transitions through
 * saved → unsaved → saving → saved on every edit cycle, or lands in
 * `error` when a write fails. The retry button re-issues the last
 * attempted save.
 */
export declare const SaveStatusIndicator: () => JSX.Element;
