import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  AGENT_MD_CONTENT,
  DEFAULT_PAGE_CSS,
  DEFAULT_THEME_CSS,
  defaultPageTsx,
} from '../../../src/shared/agentMd';

/**
 * A throwaway on-disk project for a single spec. Matches the file
 * layout that the main-process `createProject` IPC produces so the app
 * can open it straight away via the SCAMP_E2E_OPEN_PROJECT env var.
 * `scamp.config.json` is intentionally omitted — `openProject`
 * backfills it on first open.
 */
export type TestProject = {
  /** Absolute path to the project directory. */
  dir: string;
  /** Project name — the directory's basename. */
  name: string;
  /** Default page name, always 'home'. */
  pageName: string;
  /** Read `home.tsx` from disk. */
  readTsx: () => Promise<string>;
  /** Read `home.module.css` from disk. */
  readCss: () => Promise<string>;
  /** Read `theme.css` from disk. */
  readTheme: () => Promise<string>;
  /** Recursively delete the project's temp dir. */
  cleanup: () => Promise<void>;
};

const componentNameFromPage = (pageName: string): string =>
  pageName
    .split(/[-_]/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

export const createTestProject = async (
  name = 'scamp-e2e'
): Promise<TestProject> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-'));
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: false });

  const pageName = 'home';
  const componentName = componentNameFromPage(pageName);

  await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT, 'utf-8');
  await fs.writeFile(
    path.join(dir, `${pageName}.tsx`),
    defaultPageTsx(componentName, pageName),
    'utf-8'
  );
  await fs.writeFile(
    path.join(dir, `${pageName}.module.css`),
    DEFAULT_PAGE_CSS,
    'utf-8'
  );
  await fs.writeFile(path.join(dir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');

  const read = (file: string) =>
    fs.readFile(path.join(dir, file), 'utf-8');

  return {
    dir,
    name,
    pageName,
    readTsx: () => read(`${pageName}.tsx`),
    readCss: () => read(`${pageName}.module.css`),
    readTheme: () => read('theme.css'),
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
};
