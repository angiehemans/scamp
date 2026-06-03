import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  AGENT_MD_CONTENT,
  AGENT_MD_CONTENT_LEGACY,
  CLAUDE_MD_CONTENT,
  DEFAULT_NEXT_CONFIG_TS,
  DEFAULT_PAGE_CSS,
  DEFAULT_THEME_CSS,
  defaultLayoutTsx,
  defaultPackageJson,
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
  /** 'legacy' (flat) or 'nextjs' (App Router). */
  format: 'legacy' | 'nextjs';
  /** Read the home page's TSX from disk (path differs by format). */
  readTsx: () => Promise<string>;
  /** Read the home page's CSS module from disk. */
  readCss: () => Promise<string>;
  /** Read an arbitrary page's TSX/CSS by name. */
  readPage: (pageName: string) => Promise<{ tsx: string; css: string }>;
  /** Read a component's TSX/CSS by PascalCase name. Throws if missing. */
  readComponent: (
    componentName: string
  ) => Promise<{ tsx: string; css: string }>;
  /** True iff `components/<name>/<name>.tsx` exists. */
  componentExists: (componentName: string) => Promise<boolean>;
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

export type SeedComponent = {
  name: string;
  /** Optional TSX content; defaults to a blank scaffold. */
  tsxContent?: string;
  /** Optional CSS module content; defaults to `.root {}`. */
  cssContent?: string;
};

export type CreateTestProjectOptions = {
  /** Project directory's basename. Defaults to `scamp-e2e`. */
  name?: string;
  /** Project format. Defaults to `'legacy'` for back-compat. */
  format?: 'legacy' | 'nextjs';
  /**
   * Extra pages to seed beyond the default `home` page. Each name
   * gets a default TSX + CSS module written to disk. The app's page
   * scanner will pick them up on open. Default: no extras.
   */
  extraPages?: ReadonlyArray<string>;
  /**
   * Override page content before launch. Maps `pageName → { tsx, css }`.
   * Use for specs that need a page to already reference a component
   * etc. Default scaffold runs first, then these overrides are
   * applied. Writing AFTER the app opens races the format-migration
   * write, so pre-seeding here is the only reliable shape.
   */
  pageContent?: Record<string, { tsx?: string; css?: string }>;
  /**
   * Pre-seed `components/<Name>/<Name>.tsx` + `.module.css` files.
   * Only honoured for `format: 'nextjs'` (legacy doesn't support
   * components). Default: no components.
   */
  components?: ReadonlyArray<SeedComponent>;
};

const defaultComponentTsx = (componentName: string): string =>
  `import styles from './${componentName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root}>
    </div>
  );
}
`;

const writeNextjsPage = async (
  dir: string,
  pageName: string,
  isHome: boolean
): Promise<void> => {
  const pageDir = isHome ? path.join(dir, 'app') : path.join(dir, 'app', pageName);
  await fs.mkdir(pageDir, { recursive: true });
  await fs.writeFile(
    path.join(pageDir, 'page.tsx'),
    defaultPageTsx(componentNameFromPage(pageName), pageName, 'page'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(pageDir, 'page.module.css'),
    DEFAULT_PAGE_CSS,
    'utf-8'
  );
};

const writeComponent = async (
  dir: string,
  seed: SeedComponent
): Promise<void> => {
  const componentDir = path.join(dir, 'components', seed.name);
  await fs.mkdir(componentDir, { recursive: true });
  await fs.writeFile(
    path.join(componentDir, `${seed.name}.tsx`),
    seed.tsxContent ?? defaultComponentTsx(seed.name),
    'utf-8'
  );
  await fs.writeFile(
    path.join(componentDir, `${seed.name}.module.css`),
    seed.cssContent ?? '.root {\n}\n',
    'utf-8'
  );
};

export const createTestProject = async (
  options: CreateTestProjectOptions | string = {}
): Promise<TestProject> => {
  const opts =
    typeof options === 'string' ? { name: options } : options;
  const name = opts.name ?? 'scamp-e2e';
  const format = opts.format ?? 'legacy';
  const extraPages = opts.extraPages ?? [];
  const components = opts.components ?? [];
  const pageContent = opts.pageContent ?? {};

  if (format === 'legacy' && components.length > 0) {
    throw new Error(
      'createTestProject: legacy projects don\'t support components. Use format: "nextjs".'
    );
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-'));
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: false });

  const pageName = 'home';

  if (format === 'legacy') {
    await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT_LEGACY, 'utf-8');
    await writePage(dir, pageName);
    for (const extra of extraPages) {
      await writePage(dir, extra);
    }
    await fs.writeFile(path.join(dir, 'theme.css'), DEFAULT_THEME_CSS, 'utf-8');
  } else {
    await fs.writeFile(path.join(dir, 'agent.md'), AGENT_MD_CONTENT, 'utf-8');
    await fs.writeFile(path.join(dir, 'CLAUDE.md'), CLAUDE_MD_CONTENT, 'utf-8');
    await fs.writeFile(
      path.join(dir, 'package.json'),
      defaultPackageJson(name),
      'utf-8'
    );
    await fs.writeFile(
      path.join(dir, 'next.config.ts'),
      DEFAULT_NEXT_CONFIG_TS,
      'utf-8'
    );
    const appDir = path.join(dir, 'app');
    await fs.mkdir(appDir, { recursive: false });
    await fs.writeFile(
      path.join(appDir, 'layout.tsx'),
      defaultLayoutTsx(name),
      'utf-8'
    );
    await fs.writeFile(
      path.join(appDir, 'theme.css'),
      DEFAULT_THEME_CSS,
      'utf-8'
    );
    await writeNextjsPage(dir, pageName, true);
    for (const extra of extraPages) {
      await writeNextjsPage(dir, extra, false);
    }
    await fs.mkdir(path.join(dir, 'public', 'assets'), { recursive: true });
    for (const seed of components) {
      await writeComponent(dir, seed);
    }
  }

  // Apply per-page content overrides on top of the scaffolded files.
  // Runs BEFORE the app launches so chokidar / format-migration don't
  // race the test's seed write.
  for (const [pn, overrides] of Object.entries(pageContent)) {
    const tsxPath =
      format === 'nextjs'
        ? path.join(
            dir,
            'app',
            pn === pageName ? 'page.tsx' : path.join(pn, 'page.tsx')
          )
        : path.join(dir, `${pn}.tsx`);
    const cssPath =
      format === 'nextjs'
        ? path.join(
            dir,
            'app',
            pn === pageName ? 'page.module.css' : path.join(pn, 'page.module.css')
          )
        : path.join(dir, `${pn}.module.css`);
    if (overrides.tsx !== undefined) {
      await fs.writeFile(tsxPath, overrides.tsx, 'utf-8');
    }
    if (overrides.css !== undefined) {
      await fs.writeFile(cssPath, overrides.css, 'utf-8');
    }
  }

  // Suppress the legacy → nextjs migration banner during tests.
  await fs.writeFile(
    path.join(dir, 'scamp.config.json'),
    JSON.stringify({ nextjsMigrationDismissed: true }, null, 2) + '\n',
    'utf-8'
  );

  const homeTsxPath =
    format === 'nextjs' ? path.join('app', 'page.tsx') : `${pageName}.tsx`;
  const homeCssPath =
    format === 'nextjs'
      ? path.join('app', 'page.module.css')
      : `${pageName}.module.css`;
  const themePath = format === 'nextjs' ? path.join('app', 'theme.css') : 'theme.css';

  const read = (file: string): Promise<string> =>
    fs.readFile(path.join(dir, file), 'utf-8');

  const readPage = async (
    pn: string
  ): Promise<{ tsx: string; css: string }> => {
    if (format === 'nextjs') {
      const pageDir = pn === pageName ? 'app' : path.join('app', pn);
      const tsx = await read(path.join(pageDir, 'page.tsx'));
      const css = await read(path.join(pageDir, 'page.module.css'));
      return { tsx, css };
    }
    const tsx = await read(`${pn}.tsx`);
    const css = await read(`${pn}.module.css`);
    return { tsx, css };
  };

  const componentFilesFor = (
    componentName: string
  ): { tsxPath: string; cssPath: string } => ({
    tsxPath: path.join(dir, 'components', componentName, `${componentName}.tsx`),
    cssPath: path.join(
      dir,
      'components',
      componentName,
      `${componentName}.module.css`
    ),
  });

  const readComponent = async (
    componentName: string
  ): Promise<{ tsx: string; css: string }> => {
    const { tsxPath, cssPath } = componentFilesFor(componentName);
    const [tsx, css] = await Promise.all([
      fs.readFile(tsxPath, 'utf-8'),
      fs.readFile(cssPath, 'utf-8'),
    ]);
    return { tsx, css };
  };

  const componentExists = async (componentName: string): Promise<boolean> => {
    // macOS APFS is case-insensitive by default, so `fs.access` on
    // `components/button/button.tsx` resolves to `components/Button/Button.tsx`
    // and returns true even though no `button` folder exists. List the
    // parent directories and string-compare so the check matches exactly
    // on Linux CI and macOS dev machines.
    try {
      const componentsDirEntries = await fs.readdir(
        path.join(dir, 'components')
      );
      if (!componentsDirEntries.includes(componentName)) return false;
      const componentDirEntries = await fs.readdir(
        path.join(dir, 'components', componentName)
      );
      return componentDirEntries.includes(`${componentName}.tsx`);
    } catch {
      return false;
    }
  };

  return {
    dir,
    name,
    pageName,
    format,
    readTsx: () => read(homeTsxPath),
    readCss: () => read(homeCssPath),
    readPage,
    readComponent,
    componentExists,
    readTheme: () => read(themePath),
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
};
