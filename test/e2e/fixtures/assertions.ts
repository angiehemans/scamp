import { expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import * as path from 'path';

import { saveStatus } from './selectors';

export type PageFiles = {
  tsx: string;
  css: string;
};

export const readPageFiles = async (
  projectDir: string,
  pageName: string
): Promise<PageFiles> => {
  const [tsx, css] = await Promise.all([
    fs.readFile(path.join(projectDir, `${pageName}.tsx`), 'utf-8'),
    fs.readFile(path.join(projectDir, `${pageName}.module.css`), 'utf-8'),
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
