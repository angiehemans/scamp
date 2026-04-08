import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { PageCreateArgs, PageDeleteArgs, PageFile } from '@shared/types';
import { DEFAULT_PAGE_CSS, defaultPageTsx } from '@shared/agentMd';

const PAGE_NAME_RE = /^[a-zA-Z0-9-]+$/;

const componentNameFromPage = (pageName: string): string => {
  return pageName
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

const handleCreate = async (args: PageCreateArgs): Promise<PageFile> => {
  if (!PAGE_NAME_RE.test(args.pageName)) {
    throw new Error(`Invalid page name "${args.pageName}". Use alphanumeric and hyphens only.`);
  }
  const tsxPath = join(args.projectPath, `${args.pageName}.tsx`);
  const cssPath = join(args.projectPath, `${args.pageName}.module.css`);
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

export const registerPageIpc = (): void => {
  ipcMain.handle(IPC.PageCreate, (_e, args: PageCreateArgs) => handleCreate(args));
  ipcMain.handle(IPC.PageDelete, (_e, args: PageDeleteArgs) => handleDelete(args));
};
