import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  createPage,
  deletePage,
  duplicatePage,
} from '../../src/main/ipc/pageOps';
import { renamePageFiles } from '../../src/main/ipc/pageRename';
import { scaffoldNextjsProject } from '../../src/main/ipc/projectScaffold';

describe('page operations — nextjs format', () => {
  let projectDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-pageops-'));
    projectDir = path.join(tmp, 'my-project');
    await fs.mkdir(projectDir);
    await scaffoldNextjsProject(projectDir, 'my-project');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
  });

  describe('createPage', () => {
    it('writes app/<name>/page.tsx and app/<name>/page.module.css', async () => {
      const result = await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      expect(result.name).toBe('about');
      expect(result.tsxPath).toBe(
        path.join(projectDir, 'app', 'about', 'page.tsx')
      );
      const tsx = await fs.readFile(result.tsxPath, 'utf-8');
      expect(tsx).toContain(`import styles from './page.module.css';`);
      expect(tsx).toContain('export default function About()');
      const cssExists = await fs
        .access(result.cssPath)
        .then(() => true)
        .catch(() => false);
      expect(cssExists).toBe(true);
    });

    it('PascalCases hyphenated page names in the component', async () => {
      const result = await createPage(
        { projectPath: projectDir, pageName: 'checkout-flow' },
        'nextjs'
      );
      const tsx = await fs.readFile(result.tsxPath, 'utf-8');
      expect(tsx).toContain('export default function CheckoutFlow()');
    });

    it('rejects "home" as a name (the home page is created by the scaffold)', async () => {
      await expect(
        createPage({ projectPath: projectDir, pageName: 'home' }, 'nextjs')
      ).rejects.toThrow(/already exists/);
    });

    it('rejects when the target folder already exists', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      await expect(
        createPage({ projectPath: projectDir, pageName: 'about' }, 'nextjs')
      ).rejects.toThrow(/already exists/);
    });

    it('rejects invalid page names', async () => {
      await expect(
        createPage(
          { projectPath: projectDir, pageName: 'Not Valid' },
          'nextjs'
        )
      ).rejects.toThrow(/Invalid page name/);
    });
  });

  describe('deletePage', () => {
    it('removes the page folder and its contents', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      await deletePage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      const exists = await fs
        .access(path.join(projectDir, 'app', 'about'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('refuses to delete the home page', async () => {
      await expect(
        deletePage({ projectPath: projectDir, pageName: 'home' }, 'nextjs')
      ).rejects.toThrow(/can't be deleted/);
      // app/page.tsx must still be there.
      const tsx = await fs.readFile(
        path.join(projectDir, 'app', 'page.tsx'),
        'utf-8'
      );
      expect(tsx).toContain('export default function Home()');
    });

    it('leaves a non-empty page folder alone (preserves agent leftovers)', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      // Drop an unrelated file in the folder.
      await fs.writeFile(
        path.join(projectDir, 'app', 'about', 'notes.md'),
        'agent leftover',
        'utf-8'
      );
      await deletePage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      // Folder still exists with the leftover.
      const remaining = await fs.readdir(
        path.join(projectDir, 'app', 'about')
      );
      expect(remaining).toEqual(['notes.md']);
    });
  });

  describe('duplicatePage', () => {
    it('duplicates a non-home page, rewriting the component name', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      const result = await duplicatePage(
        {
          projectPath: projectDir,
          sourcePageName: 'about',
          newPageName: 'about-copy',
        },
        'nextjs'
      );
      expect(result.name).toBe('about-copy');
      const tsx = await fs.readFile(result.tsxPath, 'utf-8');
      expect(tsx).toContain('export default function AboutCopy()');
      // Import is unchanged — both pages import ./page.module.css.
      expect(tsx).toContain(`import styles from './page.module.css';`);
    });

    it('duplicates the home page into a named folder', async () => {
      const result = await duplicatePage(
        {
          projectPath: projectDir,
          sourcePageName: 'home',
          newPageName: 'home-copy',
        },
        'nextjs'
      );
      expect(result.tsxPath).toBe(
        path.join(projectDir, 'app', 'home-copy', 'page.tsx')
      );
      const tsx = await fs.readFile(result.tsxPath, 'utf-8');
      expect(tsx).toContain('export default function HomeCopy()');
      // Original home page must still exist at app/page.tsx.
      const homeTsx = await fs.readFile(
        path.join(projectDir, 'app', 'page.tsx'),
        'utf-8'
      );
      expect(homeTsx).toContain('export default function Home()');
    });

    it('rejects when the target name already exists', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      await expect(
        duplicatePage(
          {
            projectPath: projectDir,
            sourcePageName: 'home',
            newPageName: 'about',
          },
          'nextjs'
        )
      ).rejects.toThrow(/already exists/);
    });

    it('rejects "home" as the destination', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      await expect(
        duplicatePage(
          {
            projectPath: projectDir,
            sourcePageName: 'about',
            newPageName: 'home',
          },
          'nextjs'
        )
      ).rejects.toThrow(/already exists/);
    });
  });

  describe('renamePageFiles', () => {
    it('renames a non-home page folder and rewrites the component name', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      const result = await renamePageFiles(
        {
          projectPath: projectDir,
          oldPageName: 'about',
          newPageName: 'company',
        },
        'nextjs'
      );
      expect(result.name).toBe('company');
      expect(result.tsxPath).toBe(
        path.join(projectDir, 'app', 'company', 'page.tsx')
      );
      const tsx = await fs.readFile(result.tsxPath, 'utf-8');
      expect(tsx).toContain('export default function Company()');
      // Old folder is gone.
      const oldExists = await fs
        .access(path.join(projectDir, 'app', 'about'))
        .then(() => true)
        .catch(() => false);
      expect(oldExists).toBe(false);
    });

    it('refuses to rename the home page (would break Next.js routing)', async () => {
      await expect(
        renamePageFiles(
          {
            projectPath: projectDir,
            oldPageName: 'home',
            newPageName: 'landing',
          },
          'nextjs'
        )
      ).rejects.toThrow(/can't be renamed/);
    });

    it('refuses to rename to "home"', async () => {
      await createPage(
        { projectPath: projectDir, pageName: 'about' },
        'nextjs'
      );
      await expect(
        renamePageFiles(
          {
            projectPath: projectDir,
            oldPageName: 'about',
            newPageName: 'home',
          },
          'nextjs'
        )
      ).rejects.toThrow(/already exists/);
    });
  });
});
