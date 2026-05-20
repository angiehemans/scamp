/**
 * Wire up the Phase 1 component IPC channels. Mirror of
 * `registerPageIpc` — every handler resolves the project format
 * from the cached lookup before delegating, so callers don't
 * have to pass it explicitly.
 *
 * Rename / lockProp / renameProp / createFromElement land in
 * later phases (see `docs/plans/2026-05-17-components.md`).
 */
export declare const registerComponentIpc: () => void;
