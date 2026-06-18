// Target-swap write suppression. see docs/notes/components-sync.md
//
// Some multi-file operations (component rename / delete) rewrite the
// active target's files themselves, then swap the canvas to a different
// target. The store subscription's target-swap branch would otherwise
// flush the OUTGOING target's canvas state to disk, racing the operation's
// own writes. `armTargetSwapSuppression` tells the next swap to skip that
// flush; it auto-disarms after a TTL so a swap that never happens doesn't
// suppress a later, unrelated one.
let suppressNextTargetSwapWrite = false;
let suppressTargetSwapTimer = null;
const SUPPRESS_TARGET_SWAP_TTL_MS = 5000;
export const armTargetSwapSuppression = () => {
    suppressNextTargetSwapWrite = true;
    if (suppressTargetSwapTimer !== null)
        clearTimeout(suppressTargetSwapTimer);
    suppressTargetSwapTimer = setTimeout(() => {
        suppressNextTargetSwapWrite = false;
        suppressTargetSwapTimer = null;
    }, SUPPRESS_TARGET_SWAP_TTL_MS);
};
export const disarmTargetSwapSuppression = () => {
    suppressNextTargetSwapWrite = false;
    if (suppressTargetSwapTimer !== null) {
        clearTimeout(suppressTargetSwapTimer);
        suppressTargetSwapTimer = null;
    }
};
/**
 * Read-and-clear the suppress flag at the start of a target swap, also
 * cancelling the TTL timer. Returns whether the swap's outgoing flush
 * should be skipped.
 */
export const consumeTargetSwapSuppression = () => {
    const consume = suppressNextTargetSwapWrite;
    suppressNextTargetSwapWrite = false;
    if (suppressTargetSwapTimer !== null) {
        clearTimeout(suppressTargetSwapTimer);
        suppressTargetSwapTimer = null;
    }
    return consume;
};
