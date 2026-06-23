/**
 * Atomic write: write to a sibling .tmp file then rename. Prevents readers
 * (chokidar / external editors) from seeing a half-written file.
 *
 * Each write uses a unique tmp filename so concurrent writes to the same
 * target don't collide (one rename consuming the other's tmp → ENOENT).
 *
 * The rename is retried on Windows where transient OS-level locks make it
 * fail with EPERM/EBUSY intermittently — see `renameWithRetry`.
 *
 * Pure with respect to app state (no watcher / active-project coupling) so
 * it can be unit-tested against a temp dir; the handler owns the
 * containment checks and pending-write bookkeeping around it.
 */
export declare const atomicWrite: (path: string, content: string) => Promise<void>;
