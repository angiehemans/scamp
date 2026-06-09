/**
 * Extract a human-readable message from an unknown caught value.
 *
 * `catch (e)` binds `e` as `unknown`, so the message can't be read
 * directly. This normalises the common cases: real `Error` instances
 * yield their `.message`; anything else is coerced with `String()`.
 */
export declare const errorMessage: (e: unknown) => string;
