/**
 * Shared page name validator used by the main handler and the renderer's
 * inline input. Keeping it in `src/shared` means both ends of the IPC
 * agree on what "valid" means, and we can unit-test it without touching
 * any React or Electron code.
 */

const PAGE_NAME_RE = /^[a-z0-9-]+$/;

export type PageNameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

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
export const validatePageName = (
  raw: string,
  existingNames: ReadonlyArray<string>
): PageNameValidation => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Name is required.' };
  }
  if (trimmed !== trimmed.toLowerCase()) {
    return { ok: false, error: 'Use lowercase letters only.' };
  }
  if (!PAGE_NAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: 'Use lowercase letters, numbers, and hyphens only.',
    };
  }
  const lower = trimmed.toLowerCase();
  for (const existing of existingNames) {
    if (existing.toLowerCase() === lower) {
      return { ok: false, error: `A page named "${trimmed}" already exists.` };
    }
  }
  return { ok: true, value: trimmed };
};
