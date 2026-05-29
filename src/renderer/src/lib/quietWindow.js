/**
 * Time-based quiet window after external file edits.
 *
 * Phase 1.1's `externalEditTracker` only protects writes during the
 * synchronous chokidar handler — once the renderer's reload finishes
 * the flag clears immediately. That's not enough for agent bursts:
 * Claude (or any agent) typically writes the same file 2-5 times in
 * close succession as it iterates, with milliseconds between writes.
 * Without a quiet window, Scamp races each write.
 *
 * This module is pure (no Zustand, no IPC, no timers — the caller
 * supplies `now` and schedules its own expiry callback). Two reasons:
 *
 *   1. Testability — vitest can advance fake clock and assert.
 *   2. Reuse — the bridge owns the timer; this module just answers
 *      "is the window still open?"
 *
 * Default window: 2.5s. The recommended duration discussion in
 * `docs/agent-coexistence-plan.md` open question 1 picked this — long
 * enough to absorb agent write bursts, short enough that ordinary
 * canvas editing rarely notices the lag. Tunable per instance.
 */
export const DEFAULT_QUIET_WINDOW_MS = 2500;
export const createQuietWindow = (windowMs = DEFAULT_QUIET_WINDOW_MS) => {
    let quietUntil = 0;
    return {
        extend: (now = Date.now()) => {
            quietUntil = now + windowMs;
        },
        isQuiet: (now = Date.now()) => now < quietUntil,
        remainingMs: (now = Date.now()) => Math.max(0, quietUntil - now),
        clear: () => {
            quietUntil = 0;
        },
    };
};
