import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';
import { basename, join } from 'path';
import type { PageFile } from '@shared/types';
import {
  AGENT_MD_CONTENT,
  DEFAULT_NEXT_CONFIG_TS,
  DEFAULT_THEME_CSS,
  defaultLayoutTsx,
  defaultPackageJson,
} from '@shared/agentMd';
import { readProjectLegacy } from './projectScaffold';

/**
 * Anything in the legacy project root that the migrator knows how to
 * place into the new layout. Files matching these names are MOVED;
 * unrecognised root-level files (e.g. README, .gitignore, agent
 * leftovers) are left in place — flagged in `unmovedFiles` for the
 * UI to surface.
 */
const RECOGNISED_ROOT_FILES = new Set([
  'agent.md',
  'theme.css',
  // Per-project Scamp config stays at the project root.
  'scamp.config.json',
]);

/**
 * Rewrite asset references from the legacy `./assets/...` form to the
 * Next.js absolute server-root form `/assets/...`. Limited to the two
 * contexts where asset paths actually live so we don't accidentally
 * mangle a string literal that happens to contain `./assets/`:
 *
 *   - CSS `url(...)` declarations
 *   - JSX `src="..."` / `srcSet="..."` attribute values
 */
export const rewriteAssetReferences = (text: string): string => {
  let out = text;
  // CSS url("./assets/foo.png") / url('./assets/foo.png') / url(./assets/foo.png)
  out = out.replace(
    /url\(\s*(["']?)\.\/assets\//g,
    (_match, quote: string) => `url(${quote}/assets/`
  );
  // JSX src="./assets/foo.png" / src='./assets/foo.png'
  out = out.replace(
    /(src|srcSet)\s*=\s*(["'])\.\/assets\//g,
    (_match, attr: string, quote: string) => `${attr}=${quote}/assets/`
  );
  return out;
};

/**
 * Rewrite a page's TSX so it imports `./page.module.css` and continues
 * to compile. The legacy generator imported `./<pageName>.module.css`;
 * the nextjs generator always imports the co-located `./page.module.css`.
 */
const rewriteImportLine = (tsx: string, oldPageName: string): string => {
  const importRe = new RegExp(
    `(import\\s+styles\\s+from\\s+['"]\\.\\/)${oldPageName.replace(/-/g, '\\-')}(\\.module\\.css['"];?)`
  );
  return tsx.replace(importRe, `$1page$2`);
};

/**
 * Best-effort cleanup helper. Recursively delete a path; never throw.
 */
const safeRm = async (p: string): Promise<void> => {
  try {
    await fs.rm(p, { recursive: true, force: true });
  } catch {
    // Nothing to do — the migrator is best-effort about cleanup.
  }
};

/**
 * Stage a Next.js-format project tree inside `stageDir`, derived from
 * the legacy project at `legacyDir`. The stage dir is sibling to the
 * project so move-renames inside it are atomic on the same filesystem.
 *
 * Skips the destructive bit — the caller swaps stage in once staging
 * succeeds.
 */
const stageNextjsTree = async (
  legacyDir: string,
  stageDir: string,
  projectName: string,
  pages: PageFile[]
): Promise<void> => {
  await fs.mkdir(stageDir, { recursive: false });

  // app/ structure
  const appDir = join(stageDir, 'app');
  await fs.mkdir(appDir);
  await fs.writeFile(
    join(appDir, 'layout.tsx'),
    defaultLayoutTsx(projectName),
    'utf-8'
  );

  // theme.css moves into app/ so it can be imported from layout.tsx.
  const legacyThemePath = join(legacyDir, 'theme.css');
  let themeContent = DEFAULT_THEME_CSS;
  try {
    themeContent = await fs.readFile(legacyThemePath, 'utf-8');
  } catch {
    // Old project predates theme.css — fall back to defaults.
  }
  await fs.writeFile(join(appDir, 'theme.css'), themeContent, 'utf-8');

  // Pages
  for (const page of pages) {
    const isHome = page.name === 'home';
    const pageRoot = isHome ? appDir : join(appDir, page.name);
    if (!isHome) {
      await fs.mkdir(pageRoot);
    }
    const tsx = rewriteAssetReferences(
      rewriteImportLine(page.tsxContent, page.name)
    );
    const css = rewriteAssetReferences(page.cssContent);
    await fs.writeFile(join(pageRoot, 'page.tsx'), tsx, 'utf-8');
    await fs.writeFile(join(pageRoot, 'page.module.css'), css, 'utf-8');
  }

  // Project root infrastructure files
  await fs.writeFile(
    join(stageDir, 'agent.md'),
    AGENT_MD_CONTENT,
    'utf-8'
  );
  await fs.writeFile(
    join(stageDir, 'package.json'),
    defaultPackageJson(projectName),
    'utf-8'
  );
  await fs.writeFile(
    join(stageDir, 'next.config.ts'),
    DEFAULT_NEXT_CONFIG_TS,
    'utf-8'
  );

  // public/assets — copy over any legacy assets/ contents.
  const publicAssetsDir = join(stageDir, 'public', 'assets');
  await fs.mkdir(publicAssetsDir, { recursive: true });
  const legacyAssetsDir = join(legacyDir, 'assets');
  try {
    const entries = await fs.readdir(legacyAssetsDir);
    for (const entry of entries) {
      // Plain copy — supports nested folders inside assets/.
      await fs.cp(
        join(legacyAssetsDir, entry),
        join(publicAssetsDir, entry),
        { recursive: true }
      );
    }
  } catch {
    // No legacy assets/ folder — nothing to migrate.
  }
};

export type MigrateResult = {
  backupPath: string;
  unmovedFiles: string[];
};

/**
 * Atomic-ish legacy → nextjs migration.
 *
 * Strategy:
 *   1. Read all legacy pages into memory.
 *   2. Stage the nextjs tree in a sibling `.scamp-stage-<id>/` dir.
 *      Any failure here is recoverable: we delete the stage and the
 *      original project is untouched.
 *   3. Move all known legacy artefacts into a sibling
 *      `.scamp-backup-<timestamp>/` dir. We keep this around so the
 *      user has a recovery path.
 *   4. Move the stage's contents into the project root.
 *
 * Step 4 is the only window where the project is in a partial state
 * on disk. Each individual `fs.rename` is atomic on a single
 * filesystem; the multi-step swap isn't, but the backup directory is
 * the recovery path. We surface its location to the user.
 */
export const migrateLegacyToNextjs = async (
  projectPath: string
): Promise<MigrateResult> => {
  const projectName = basename(projectPath);

  // 1. Read the legacy project.
  const pages = await readProjectLegacy(projectPath);
  if (pages.length === 0) {
    throw new Error(
      'No pages found in this project — nothing to migrate. Open the project, add a page, and try again.'
    );
  }

  // 2. Stage the nextjs tree.
  const stageDir = join(
    projectPath,
    `.scamp-stage-${randomBytes(4).toString('hex')}`
  );
  try {
    await stageNextjsTree(projectPath, stageDir, projectName, pages);
  } catch (err) {
    await safeRm(stageDir);
    throw err;
  }

  // 3. Move the legacy artefacts into a backup directory.
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const backupDir = join(projectPath, `.scamp-backup-${timestamp}`);
  await fs.mkdir(backupDir, { recursive: false });

  const unmovedFiles: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(projectPath);
  } catch (err) {
    await safeRm(stageDir);
    await safeRm(backupDir);
    throw err;
  }

  try {
    for (const entry of entries) {
      // Skip the stage dir and the backup dir we just created — they
      // aren't legacy artefacts.
      if (entry.startsWith('.scamp-stage-')) continue;
      if (entry.startsWith('.scamp-backup-')) continue;

      const fullPath = join(projectPath, entry);
      const isLegacyPage =
        entry.endsWith('.tsx') || entry.endsWith('.module.css');
      const isLegacyAssets = entry === 'assets';
      const isRecognised = RECOGNISED_ROOT_FILES.has(entry);

      if (isLegacyPage || isLegacyAssets || isRecognised) {
        await fs.rename(fullPath, join(backupDir, entry));
      } else {
        // Unknown file at the project root — leave it. Surface it so
        // the UI can warn the user.
        unmovedFiles.push(entry);
      }
    }
  } catch (err) {
    // Try to roll back: move anything already in the backup dir back
    // into place. Best-effort; if this fails the user has their files
    // safe in the backup dir either way.
    try {
      const backedUp = await fs.readdir(backupDir);
      for (const entry of backedUp) {
        await fs
          .rename(join(backupDir, entry), join(projectPath, entry))
          .catch(() => undefined);
      }
      await safeRm(backupDir);
    } catch {
      // Give up — the user has the backup dir.
    }
    await safeRm(stageDir);
    throw err;
  }

  // 4. Move staged contents into the project root.
  try {
    const staged = await fs.readdir(stageDir);
    for (const entry of staged) {
      await fs.rename(join(stageDir, entry), join(projectPath, entry));
    }
    await fs.rmdir(stageDir);
  } catch (err) {
    // Mid-swap failure. The user's files are safe in the backup dir.
    // Surface a clear error pointing at it.
    throw new Error(
      `Migration failed mid-swap. Your original project files are at ${backupDir}. Move them back into ${projectPath} and try again. (${err instanceof Error ? err.message : String(err)})`
    );
  }

  return { backupPath: backupDir, unmovedFiles };
};
