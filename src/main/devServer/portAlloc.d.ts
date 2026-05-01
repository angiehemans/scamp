/**
 * Bind to an ephemeral local port to discover what's free, then
 * release. Caller spawns its process on the returned port. There's
 * a small race between release and re-bind; callers retry once if
 * spawn fails with EADDRINUSE.
 */
export declare const allocateFreePort: () => Promise<number>;
