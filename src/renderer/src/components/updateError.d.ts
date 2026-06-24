/**
 * Categorise an updater error message for display. Returns a short
 * sentence the banner can show directly. Unknown errors fall through to
 * the raw message so nothing is hidden from the user.
 */
export declare const describeUpdateError: (raw: string) => string;
