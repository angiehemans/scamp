import type { PageFile, PageRenameArgs, ProjectFormat } from '@shared/types';
/**
 * Rewrite the CSS-module import line. Returns `null` when the import
 * line can't be found — the caller decides whether that's a hard error
 * (rename) or a silent no-op (duplicate leaves the source component
 * name untouched).
 */
export declare const rewriteImportLine: (tsx: string, oldPageName: string, newPageName: string) => string | null;
export declare const rewriteComponentName: (tsx: string, newComponentName: string) => string | null;
/**
 * Rewrite every `href="/<oldSlug>..."` reference in a TSX source to
 * use `<newSlug>` instead. Anchored to the attribute syntax to avoid
 * mangling string literals that happen to contain a path-shaped
 * substring. Preserves anything after the slug (subpath, query,
 * fragment) so `href="/about/team#contact"` becomes
 * `href="/landing/team#contact"`.
 *
 * Returns the rewritten string. When no references match, the
 * original string is returned unchanged (callers can compare by
 * reference / value to skip unnecessary writes).
 */
export declare const rewriteHrefSlug: (tsx: string, oldSlug: string, newSlug: string) => string;
/**
 * Rename a page on disk. Writes the new files first, then deletes the
 * old ones, so a crash mid-rename leaves duplicate files rather than
 * no files — the user can reconcile on next project open.
 *
 * Fails hard if the TSX rewrite regexes don't match: a successful
 * rename that left the TSX importing a deleted CSS module would break
 * the page at render time.
 */
export declare const renamePageFiles: (args: PageRenameArgs, format: ProjectFormat, onSuppress?: (path: string) => void) => Promise<PageFile>;
