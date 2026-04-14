import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type {
  PageCreateArgs,
  PageDeleteArgs,
  PageDuplicateArgs,
  PageFile,
} from '@shared/types';
import { DEFAULT_PAGE_CSS, defaultPageTsx } from '@shared/agentMd';

const PAGE_NAME_RE = /^[a-zA-Z0-9-]+$/;

const componentNameFromPage = (pageName: string): string => {
  return pageName
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

/** True when the given path is already a file on disk. */
const pathExists = async (p: string): Promise<boolean> => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

const handleCreate = async (args: PageCreateArgs): Promise<PageFile> => {
  if (!PAGE_NAME_RE.test(args.pageName)) {
    throw new Error(`Invalid page name "${args.pageName}". Use alphanumeric and hyphens only.`);
  }
  const tsxPath = join(args.projectPath, `${args.pageName}.tsx`);
  const cssPath = join(args.projectPath, `${args.pageName}.module.css`);
  // Refuse to overwrite an existing page — names must be unique.
  if ((await pathExists(tsxPath)) || (await pathExists(cssPath))) {
    throw new Error(`A page named "${args.pageName}" already exists.`);
  }
  const componentName = componentNameFromPage(args.pageName);
  const tsxContent = defaultPageTsx(componentName, args.pageName);
  const cssContent = DEFAULT_PAGE_CSS;
  await fs.writeFile(tsxPath, tsxContent, 'utf-8');
  await fs.writeFile(cssPath, cssContent, 'utf-8');
  return { name: args.pageName, tsxPath, cssPath, tsxContent, cssContent };
};

const handleDelete = async (args: PageDeleteArgs): Promise<void> => {
  if (!PAGE_NAME_RE.test(args.pageName)) {
    throw new Error(`Invalid page name "${args.pageName}".`);
  }
  const tsxPath = join(args.projectPath, `${args.pageName}.tsx`);
  const cssPath = join(args.projectPath, `${args.pageName}.module.css`);
  await fs.rm(tsxPath, { force: true });
  await fs.rm(cssPath, { force: true });
};

/**
 * Rewrite the CSS-module import and the default-export component name in
 * a page's TSX so it matches the new page name. If either rewrite fails
 * to match, the TSX is returned unchanged — the copied page still works,
 * it just keeps the source's component name.
 */
const rewriteDuplicateTsx = (
  tsx: string,
  sourcePageName: string,
  newPageName: string,
  newComponentName: string
): string => {
  let out = tsx;

  // Import line: `import styles from './home.module.css';`
  const importRe = new RegExp(
    `(import\\s+styles\\s+from\\s+['"]\\.\\/)${sourcePageName.replace(/-/g, '\\-')}(\\.module\\.css['"];?)`
  );
  out = out.replace(importRe, `$1${newPageName}$2`);

  // Default-export function: `export default function Home(` → replace
  // only the component name. Tight regex so we don't accidentally rewrite
  // something else in the file.
  out = out.replace(
    /(export\s+default\s+function\s+)[A-Za-z_][A-Za-z0-9_]*(\s*\()/,
    `$1${newComponentName}$2`
  );

  return out;
};

const handleDuplicate = async (args: PageDuplicateArgs): Promise<PageFile> => {
  if (!PAGE_NAME_RE.test(args.newPageName)) {
    throw new Error(
      `Invalid page name "${args.newPageName}". Use alphanumeric and hyphens only.`
    );
  }
  const sourceTsxPath = join(args.projectPath, `${args.sourcePageName}.tsx`);
  const sourceCssPath = join(args.projectPath, `${args.sourcePageName}.module.css`);
  const newTsxPath = join(args.projectPath, `${args.newPageName}.tsx`);
  const newCssPath = join(args.projectPath, `${args.newPageName}.module.css`);

  if ((await pathExists(newTsxPath)) || (await pathExists(newCssPath))) {
    throw new Error(`A page named "${args.newPageName}" already exists.`);
  }
  if (!(await pathExists(sourceTsxPath)) || !(await pathExists(sourceCssPath))) {
    throw new Error(`Source page "${args.sourcePageName}" is missing.`);
  }

  const [sourceTsx, sourceCss] = await Promise.all([
    fs.readFile(sourceTsxPath, 'utf-8'),
    fs.readFile(sourceCssPath, 'utf-8'),
  ]);

  const newComponentName = componentNameFromPage(args.newPageName);
  const newTsx = rewriteDuplicateTsx(
    sourceTsx,
    args.sourcePageName,
    args.newPageName,
    newComponentName
  );

  await fs.writeFile(newTsxPath, newTsx, 'utf-8');
  await fs.writeFile(newCssPath, sourceCss, 'utf-8');

  return {
    name: args.newPageName,
    tsxPath: newTsxPath,
    cssPath: newCssPath,
    tsxContent: newTsx,
    cssContent: sourceCss,
  };
};

export const registerPageIpc = (): void => {
  ipcMain.handle(IPC.PageCreate, (_e, args: PageCreateArgs) => handleCreate(args));
  ipcMain.handle(IPC.PageDelete, (_e, args: PageDeleteArgs) => handleDelete(args));
  ipcMain.handle(IPC.PageDuplicate, (_e, args: PageDuplicateArgs) => handleDuplicate(args));
};
