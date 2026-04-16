import { promises as fs } from 'fs';
import { join } from 'path';
import type { PageFile, PageRenameArgs } from '@shared/types';

const PAGE_NAME_RE = /^[a-zA-Z0-9-]+$/;

const componentNameFromPage = (pageName: string): string => {
  return pageName
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

const pathExists = async (p: string): Promise<boolean> => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

/**
 * Rewrite the CSS-module import line. Returns `null` when the import
 * line can't be found — the caller decides whether that's a hard error
 * (rename) or a silent no-op (duplicate leaves the source component
 * name untouched).
 */
export const rewriteImportLine = (
  tsx: string,
  oldPageName: string,
  newPageName: string
): string | null => {
  const importRe = new RegExp(
    `(import\\s+styles\\s+from\\s+['"]\\.\\/)${oldPageName.replace(/-/g, '\\-')}(\\.module\\.css['"];?)`
  );
  if (!importRe.test(tsx)) return null;
  return tsx.replace(importRe, `$1${newPageName}$2`);
};

const COMPONENT_FN_RE =
  /(export\s+default\s+function\s+)[A-Za-z_][A-Za-z0-9_]*(\s*\()/;

export const rewriteComponentName = (
  tsx: string,
  newComponentName: string
): string | null => {
  if (!COMPONENT_FN_RE.test(tsx)) return null;
  return tsx.replace(COMPONENT_FN_RE, `$1${newComponentName}$2`);
};

/**
 * Rename a page on disk. Writes the new files first, then deletes the
 * old ones, so a crash mid-rename leaves duplicate files rather than
 * no files — the user can reconcile on next project open.
 *
 * Fails hard if the TSX rewrite regexes don't match: a successful
 * rename that left the TSX importing a deleted CSS module would break
 * the page at render time.
 */
export const renamePageFiles = async (
  args: PageRenameArgs,
  onSuppress?: (path: string) => void
): Promise<PageFile> => {
  if (!PAGE_NAME_RE.test(args.newPageName)) {
    throw new Error(
      `Invalid page name "${args.newPageName}". Use alphanumeric and hyphens only.`
    );
  }
  if (args.oldPageName === args.newPageName) {
    throw new Error('New name is the same as the old one.');
  }

  const oldTsxPath = join(args.projectPath, `${args.oldPageName}.tsx`);
  const oldCssPath = join(args.projectPath, `${args.oldPageName}.module.css`);
  const newTsxPath = join(args.projectPath, `${args.newPageName}.tsx`);
  const newCssPath = join(args.projectPath, `${args.newPageName}.module.css`);

  if ((await pathExists(newTsxPath)) || (await pathExists(newCssPath))) {
    throw new Error(`A page named "${args.newPageName}" already exists.`);
  }
  if (!(await pathExists(oldTsxPath)) || !(await pathExists(oldCssPath))) {
    throw new Error(`Source page "${args.oldPageName}" is missing.`);
  }

  const [oldTsx, oldCss] = await Promise.all([
    fs.readFile(oldTsxPath, 'utf-8'),
    fs.readFile(oldCssPath, 'utf-8'),
  ]);

  const withImport = rewriteImportLine(oldTsx, args.oldPageName, args.newPageName);
  if (withImport === null) {
    throw new Error(
      `Couldn't find the CSS-module import in ${args.oldPageName}.tsx — rename aborted.`
    );
  }
  const newComponentName = componentNameFromPage(args.newPageName);
  const rewritten = rewriteComponentName(withImport, newComponentName);
  if (rewritten === null) {
    throw new Error(
      `Couldn't find the default-export function in ${args.oldPageName}.tsx — rename aborted. Restore the default "export default function <Name>()" signature before retrying.`
    );
  }

  onSuppress?.(oldTsxPath);
  onSuppress?.(oldCssPath);
  onSuppress?.(newTsxPath);
  onSuppress?.(newCssPath);

  try {
    await fs.writeFile(newTsxPath, rewritten, 'utf-8');
    await fs.writeFile(newCssPath, oldCss, 'utf-8');
  } catch (err) {
    // Best-effort cleanup so we don't leave half-written new files
    // alongside the still-intact old ones.
    await fs.rm(newTsxPath, { force: true }).catch(() => undefined);
    await fs.rm(newCssPath, { force: true }).catch(() => undefined);
    throw err;
  }

  await fs.rm(oldTsxPath, { force: true });
  await fs.rm(oldCssPath, { force: true });

  return {
    name: args.newPageName,
    tsxPath: newTsxPath,
    cssPath: newCssPath,
    tsxContent: rewritten,
    cssContent: oldCss,
  };
};
