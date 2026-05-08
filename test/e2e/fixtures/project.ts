import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  AGENT_MD_CONTENT_LEGACY,
  DEFAULT_PAGE_CSS,
  DEFAULT_THEME_CSS,
  defaultPageTsx,
} from '../../../src/shared/agentMd';

/**
 * A throwaway on-disk project for a single spec. Produces the legacy
 * flat layout (the app supports both `legacy` and `nextjs` formats;
 * the e2e suite exercises legacy because the existing specs assert on
 * flat file paths). The app opens it straight away via the
 * SCAMP_E2E_OPEN_PROJECT env var.
 *
 * A `scamp.config.json` is written with `nextjsMigrationDismissed: true`
 * so the legacy → nextjs migration banner stays out of the way of the
 * canvas during tests. Other config fields are left out and backfilled
 * to defaults by `openProject` on first read.
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

const writePage = async (dir: string, name: string): Promise<void> => {
  await fs.writeFile(
    path.join(dir, `${name}.tsx`),
    defaultPageTsx(componentNameFromPage(name), name),
    'utf-8'
  );
  await fs.writeFile(
    path.join(dir, `${name}.module.css`),
    DEFAULT_PAGE_CSS,
    'utf-8'
  );
};

export type CreateTestProjectOptions = {
  /** Project directory's basename. Defaults to `scamp-e2e`. */
  name?: string;
  /**
   * Extra pages to seed beyond the default `home` page. Each name
   * gets a default TSX + CSS module written to disk. The app's page
   * scanner will pick them up on open. Default: no extras.
   */
  extraPages?: ReadonlyArray<string>;
};

export const createTestProject = async (
  options: CreateTestProjectOptions | string = {}
): Promise<TestProject> => {
  // Backwards-compat: callers used to pass the name as a string
  // positional. Keep that working so wave-1 fixtures don't have to
  // change.
  const opts =
    typeof options === 'string' ? { name: options } : options;
  const name = opts.name ?? 'scamp-e2e';
  const extraPages = opts.extraPages ?? [];

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-'));
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: false });

  const pageName = 'home';

  await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT_LEGACY, 'utf-8');
  await writePage(dir, pageName);
  for (const extra of extraPages) {
    await writePage(dir, extra);
  }
  await fs.writeFile(path.join(dir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');

  // Suppress the legacy → nextjs migration banner so it doesn't sit on
  // top of the canvas during tests. `parseProjectConfig` fills in the
  // other fields (artboardBackground, canvasWidth, breakpoints, …)
  // from defaults on first read.
  await fs.writeFile(
    path.join(dir, 'scamp.config.json'),
    JSON.stringify({ nextjsMigrationDismissed: true }, null, 2) + '\n',
    'utf-8'
  );

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
