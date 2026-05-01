/**
 * Shared page name validator used by the main handler and the renderer's
 * inline input. Keeping it in `src/shared` means both ends of the IPC
 * agree on what "valid" means, and we can unit-test it without touching
 * any React or Electron code.
 */
export type PageNameValidation = {
    ok: true;
    value: string;
} | {
    ok: false;
    error: string;
};
/**
 * Validate a page name for use as both a file name and a URL segment.
 *
 * Rules:
 *   - lowercase
 *   - alphanumeric characters and hyphens only
 *   - non-empty
 *   - doesn't collide with any of `existingNames` (case-insensitive)
 *
 * Trims outer whitespace before validating — typing a trailing space
 * while composing shouldn't be an error on its own.
 */
export declare const validatePageName: (raw: string, existingNames: ReadonlyArray<string>) => PageNameValidation;
