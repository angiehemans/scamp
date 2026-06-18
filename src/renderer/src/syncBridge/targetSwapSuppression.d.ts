export declare const armTargetSwapSuppression: () => void;
export declare const disarmTargetSwapSuppression: () => void;
/**
 * Read-and-clear the suppress flag at the start of a target swap, also
 * cancelling the TTL timer. Returns whether the swap's outgoing flush
 * should be skipped.
 */
export declare const consumeTargetSwapSuppression: () => boolean;
