import { expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import * as path from 'path';

import { viewNameForPage } from '../../../src/shared/templates';

import { saveStatus } from './selectors';

export type PageFiles = {
  tsx: string;
  css: string;
};

const exists = (file: string): Promise<boolean> =>
  fs.access(file).then(
    () => true,
    () => false
  );

/**
 * The page's TSX and CSS module, wherever the project's format keeps
 * them: `views/<Name>/` in a framework project, `app/` in a Next.js
 * one, the root in a legacy one. Probed from disk so a spec reads the
 * same way under `SCAMP_E2E_FORMAT`.
 */
export const readPageFiles = async (
  projectDir: string,
  pageName: string
): Promise<PageFiles> => {
  const view = viewNameForPage(pageName);
  const viewTsx = path.join(projectDir, 'views', view, `${view}.tsx`);
  const appDir = pageName === 'home' ? path.join(projectDir, 'app') : path.join(projectDir, 'app', pageName);
  const [tsxPath, cssPath] = (await exists(viewTsx))
    ? [viewTsx, path.join(projectDir, 'views', view, `${view}.module.css`)]
    : (await exists(path.join(appDir, 'page.tsx')))
      ? [path.join(appDir, 'page.tsx'), path.join(appDir, 'page.module.css')]
      : [path.join(projectDir, `${pageName}.tsx`), path.join(projectDir, `${pageName}.module.css`)];
  const [tsx, css] = await Promise.all([
    fs.readFile(tsxPath, 'utf-8'),
    fs.readFile(cssPath, 'utf-8'),
  ]);
  return { tsx, css };
};

export const projectFileExists = async (
  projectDir: string,
  name: string
): Promise<boolean> => {
  try {
    await fs.access(path.join(projectDir, name));
    return true;
  } catch {
    return false;
  }
};

/**
 * Wait until the save-status indicator lands on `saved`. The sync
 * bridge debounces writes ~200 ms, then the IPC round-trip + watcher
 * ack take another beat — settle time is usually <1 s in tests but
 * can spike on slow CI, so we give this a generous timeout.
 */
export const waitForSaved = async (page: Page, timeout = 10_000): Promise<void> => {
  await expect(saveStatus(page)).toHaveAttribute('data-status', 'saved', {
    timeout,
  });
};
