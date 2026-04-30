import { promises as fs } from 'fs';
import { join } from 'path';
import type { PageFile, ProjectFormat } from '@shared/types';
import {
  AGENT_MD_CONTENT,
  AGENT_MD_CONTENT_LEGACY,
  DEFAULT_NEXT_CONFIG_TS,
  DEFAULT_PAGE_CSS,
  DEFAULT_THEME_CSS,
  defaultLayoutTsx,
  defaultPackageJson,
  defaultPageTsx,
} from '@shared/agentMd';

const componentNameFromPage = (pageName: string): string =>
  pageName
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * Path on disk where a project's `theme.css` lives. Nextjs projects
 * co-locate it inside `app/` so the root layout can import it and
 * `next dev` picks up the tokens; legacy keeps it at the project root.
 */
export const themePathFor = (
  projectPath: string,
  format: ProjectFormat
): string =>
  format === 'nextjs'
    ? join(projectPath, 'app', 'theme.css')
    : join(projectPath, 'theme.css');

/**
 * Read a single page (TSX + CSS pair) from disk, returning null when
 * the pair is incomplete (one half missing) so callers can skip it
 * without crashing the project open.
 */
const readPage = async (
  name: string,
  tsxPath: string,
  cssPath: string
): Promise<PageFile | null> => {
  try {
    const [tsxContent, cssContent] = await Promise.all([
      fs.readFile(tsxPath, 'utf-8'),
      fs.readFile(cssPath, 'utf-8'),
    ]);
    return { name, tsxPath, cssPath, tsxContent, cssContent };
  } catch {
    return null;
  }
};

export const readProjectLegacy = async (
  folderPath: string
): Promise<PageFile[]> => {
  const entries = await fs.readdir(folderPath);
  const tsxFiles = entries.filter((f) => f.endsWith('.tsx'));

  const pages: PageFile[] = [];
  for (const tsxFile of tsxFiles) {
    const baseName = tsxFile.replace(/\.tsx$/, '');
    const cssFile = `${baseName}.module.css`;
    if (!entries.includes(cssFile)) continue;
    const page = await readPage(
      baseName,
      join(folderPath, tsxFile),
      join(folderPath, cssFile)
    );
    if (page) pages.push(page);
  }
  return pages;
};

/**
 * Read pages from a Next.js App Router project layout. The root page
 * lives at `app/page.tsx` and is keyed as `'home'` internally so the
 * rest of the app (sidebar labelling, component-name derivation, page
 * switching) works without special-casing. Additional pages live in
 * folders inside `app/` — e.g. `app/about/page.tsx` is keyed `'about'`.
 */
export const readProjectNextjs = async (
  folderPath: string
): Promise<PageFile[]> => {
  const appDir = join(folderPath, 'app');
  const pages: PageFile[] = [];

  // Root / home page
  const homePage = await readPage(
    'home',
    join(appDir, 'page.tsx'),
    join(appDir, 'page.module.css')
  );
  if (homePage) pages.push(homePage);

  // Nested page folders
  let entries: { name: string; isDirectory: () => boolean }[] = [];
  try {
    entries = await fs.readdir(appDir, { withFileTypes: true });
  } catch {
    return pages;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const page = await readPage(
      entry.name,
      join(appDir, entry.name, 'page.tsx'),
      join(appDir, entry.name, 'page.module.css')
    );
    if (page) pages.push(page);
  }
  return pages;
};

/**
 * Write the Next.js App Router scaffold into a freshly-created
 * project folder. Creates `app/` (with the home page, layout, and
 * `theme.css` co-located so `next dev` picks up the tokens),
 * `public/assets/`, and the auto-generated `package.json` /
 * `next.config.ts` at the project root.
 *
 * Caller is responsible for creating the project directory itself
 * and for writing `scamp.config.json` (via `ensureProjectConfig`).
 */
export const scaffoldNextjsProject = async (
  projectPath: string,
  projectName: string
): Promise<void> => {
  await fs.writeFile(
    join(projectPath, 'agent.md'),
    AGENT_MD_CONTENT,
    'utf-8'
  );
  await fs.writeFile(
    join(projectPath, 'package.json'),
    defaultPackageJson(projectName),
    'utf-8'
  );
  await fs.writeFile(
    join(projectPath, 'next.config.ts'),
    DEFAULT_NEXT_CONFIG_TS,
    'utf-8'
  );

  const appDir = join(projectPath, 'app');
  await fs.mkdir(appDir, { recursive: false });
  await fs.writeFile(
    join(appDir, 'layout.tsx'),
    defaultLayoutTsx(projectName),
    'utf-8'
  );
  await fs.writeFile(
    join(appDir, 'theme.css'),
    DEFAULT_THEME_CSS,
    'utf-8'
  );

  const componentName = componentNameFromPage('home');
  await fs.writeFile(
    join(appDir, 'page.tsx'),
    defaultPageTsx(componentName, 'home', 'page'),
    'utf-8'
  );
  await fs.writeFile(
    join(appDir, 'page.module.css'),
    DEFAULT_PAGE_CSS,
    'utf-8'
  );

  await fs.mkdir(join(projectPath, 'public', 'assets'), { recursive: true });
};

/**
 * Legacy flat-layout scaffold. Kept around for the migrator's
 * fixture-creation tests and for parity in the shared scaffold module.
 */
export const scaffoldLegacyProject = async (
  projectPath: string
): Promise<void> => {
  await fs.writeFile(
    join(projectPath, 'agent.md'),
    AGENT_MD_CONTENT_LEGACY,
    'utf-8'
  );
  const componentName = componentNameFromPage('home');
  await fs.writeFile(
    join(projectPath, 'home.tsx'),
    defaultPageTsx(componentName, 'home'),
    'utf-8'
  );
  await fs.writeFile(
    join(projectPath, 'home.module.css'),
    DEFAULT_PAGE_CSS,
    'utf-8'
  );
  await fs.writeFile(
    join(projectPath, 'theme.css'),
    DEFAULT_THEME_CSS,
    'utf-8'
  );
};
