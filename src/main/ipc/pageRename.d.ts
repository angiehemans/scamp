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
 * Rename a page on disk. Writes the new files first, then deletes the
 * old ones, so a crash mid-rename leaves duplicate files rather than
 * no files — the user can reconcile on next project open.
 *
 * Fails hard if the TSX rewrite regexes don't match: a successful
 * rename that left the TSX importing a deleted CSS module would break
 * the page at render time.
 */
export declare const renamePageFiles: (args: PageRenameArgs, format: ProjectFormat, onSuppress?: (path: string) => void) => Promise<PageFile>;
