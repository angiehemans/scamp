/** The string that would be copied right now. Exported for tests. */
export declare const currentContextString: () => string;
/** Copy it. Resolves false when the write failed, so callers can skip the
 *  "Copied" confirmation rather than claim something that didn't happen. */
export declare const copyContextToClipboard: () => Promise<boolean>;
