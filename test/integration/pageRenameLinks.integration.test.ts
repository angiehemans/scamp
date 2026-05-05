import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { renamePageFiles } from '../../src/main/ipc/pageRename';

const ABOUT_PAGE_TSX = `import styles from './page.module.css';

export default function About() {
  return (
    <div className={styles.root} data-scamp-id="root">
      <h1 className={styles.text_a001} data-scamp-id="text_a001">About</h1>
    </div>
  );
}
`;

const ABOUT_PAGE_CSS = `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.text_a001 {
  font-size: 24px;
}
`;

const HOME_PAGE_WITH_LINKS_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.root} data-scamp-id="root">
      <a className={styles.nav_n001} data-scamp-id="nav_n001" href="/about">About us</a>
      <a className={styles.deep_d001} data-scamp-id="deep_d001" href="/about/team#contact">Team</a>
      <a className={styles.ext_e001} data-scamp-id="ext_e001" href="https://example.com">External</a>
      <a className={styles.same_s001} data-scamp-id="same_s001" href="/">Home</a>
    </div>
  );
}
`;

const HOME_PAGE_CSS = `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}
`;

describe('page rename refactors href references in sibling pages', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-rename-href-'));
    const appDir = path.join(projectDir, 'app');
    await fs.mkdir(appDir);
    // Home page with links to /about (and other hrefs we shouldn't touch).
    await fs.writeFile(
      path.join(appDir, 'page.tsx'),
      HOME_PAGE_WITH_LINKS_TSX,
      'utf-8'
    );
    await fs.writeFile(
      path.join(appDir, 'page.module.css'),
      HOME_PAGE_CSS,
      'utf-8'
    );
    // About page (the one we're renaming).
    const aboutDir = path.join(appDir, 'about');
    await fs.mkdir(aboutDir);
    await fs.writeFile(
      path.join(aboutDir, 'page.tsx'),
      ABOUT_PAGE_TSX,
      'utf-8'
    );
    await fs.writeFile(
      path.join(aboutDir, 'page.module.css'),
      ABOUT_PAGE_CSS,
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('rewrites every href reference to the renamed page on sibling pages', async () => {
    await renamePageFiles(
      {
        projectPath: projectDir,
        oldPageName: 'about',
        newPageName: 'company',
      },
      'nextjs'
    );

    // The home page's hrefs should be rewritten.
    const homeAfter = await fs.readFile(
      path.join(projectDir, 'app', 'page.tsx'),
      'utf-8'
    );
    expect(homeAfter).toContain('href="/company"');
    expect(homeAfter).toContain('href="/company/team#contact"');
    // External hrefs untouched.
    expect(homeAfter).toContain('href="https://example.com"');
    // Other internal hrefs untouched.
    expect(homeAfter).toContain('href="/"');
  });

  it('moves the renamed page to its new folder', async () => {
    await renamePageFiles(
      {
        projectPath: projectDir,
        oldPageName: 'about',
        newPageName: 'company',
      },
      'nextjs'
    );
    expect(
      await fs
        .stat(path.join(projectDir, 'app', 'company', 'page.tsx'))
        .then(() => true)
        .catch(() => false)
    ).toBe(true);
    expect(
      await fs
        .stat(path.join(projectDir, 'app', 'about'))
        .then(() => true)
        .catch(() => false)
    ).toBe(false);
  });

  it('does not touch sibling pages that have no matching href', async () => {
    // Replace home with one that has no /about reference.
    await fs.writeFile(
      path.join(projectDir, 'app', 'page.tsx'),
      `import styles from './page.module.css';

export default function Home() {
  return <div className={styles.root} data-scamp-id="root">Hi</div>;
}
`,
      'utf-8'
    );
    const before = await fs.readFile(
      path.join(projectDir, 'app', 'page.tsx'),
      'utf-8'
    );
    await renamePageFiles(
      {
        projectPath: projectDir,
        oldPageName: 'about',
        newPageName: 'company',
      },
      'nextjs'
    );
    const after = await fs.readFile(
      path.join(projectDir, 'app', 'page.tsx'),
      'utf-8'
    );
    expect(after).toBe(before);
  });
});
