/**
 * Header indicator showing whether canvas edits are in sync with disk.
 * Driven by `useSaveStatusStore`. Six states:
 *
 *   - saved        — canvas == disk.
 *   - unsaved      — canvas has uncommitted edits, debounce pending.
 *   - saving       — write IPC in flight.
 *   - error        — write failed (generic IPC failure); retryable.
 *   - paused       — sync engine intentionally suspended writes
 *                    because an external editor is touching project
 *                    files. Canvas edits queue in memory. Click to
 *                    expand for a `Resume now` override.
 *   - diverged     — pause cleared; canvas + disk don't match;
 *                    user picks Save canvas or Discard canvas.
 *   - reloaded-from-disk
 *                  — last write hit a conflict and Scamp adopted
 *                    disk; user's in-flight edit was discarded. NOT
 *                    retryable.
 *
 * `paused`, `diverged`, and `reloaded-from-disk` are clickable to
 * open the popover. The popover's action buttons are wired in
 * Phase 3 (Resume) and Phase 5 (Save / Discard).
 */
export declare const SaveStatusIndicator: () => JSX.Element;
