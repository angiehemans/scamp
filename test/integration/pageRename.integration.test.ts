import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { renamePageFiles } from '../../src/main/ipc/pageRename';

const SOURCE_TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div className={styles.root}>
      <div className={styles.rect_a1b2} data-scamp-id="a1b2" />
    </div>
  );
}
`;

const SOURCE_CSS = `.root {
  width: 1440px;
  height: 900px;
  position: relative;
}

.rect_a1b2 {
  background: red;
  width: 100px;
  height: 100px;
}
`;

describe('page rename integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-rename-'));
    await fs.writeFile(path.join(tmpDir, 'home.tsx'), SOURCE_TSX, 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'home.module.css'),
      SOURCE_CSS,
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('renames both files and rewrites the TSX import + component name', async () => {
    const result = await renamePageFiles(
      {
        projectPath: tmpDir,
        oldPageName: 'home',
        newPageName: 'landing',
      },
      'legacy'
    );

    expect(result.name).toBe('landing');

    const entries = (await fs.readdir(tmpDir)).sort();
    expect(entries).toEqual(['landing.module.css', 'landing.tsx']);

    const newTsx = await fs.readFile(path.join(tmpDir, 'landing.tsx'), 'utf-8');
    expect(newTsx).toContain(`import styles from './landing.module.css'`);
    expect(newTsx).toContain('export default function Landing(');
    expect(newTsx).not.toContain('./home.module.css');
    expect(newTsx).not.toContain('function Home(');

    const newCss = await fs.readFile(
      path.join(tmpDir, 'landing.module.css'),
      'utf-8'
    );
    expect(newCss).toBe(SOURCE_CSS);
  });

  it('derives a PascalCase component name from a hyphenated page name', async () => {
    await renamePageFiles(
      {
        projectPath: tmpDir,
        oldPageName: 'home',
        newPageName: 'checkout-flow',
      },
      'legacy'
    );

    const newTsx = await fs.readFile(
      path.join(tmpDir, 'checkout-flow.tsx'),
      'utf-8'
    );
    expect(newTsx).toContain('export default function CheckoutFlow(');
    expect(newTsx).toContain(`import styles from './checkout-flow.module.css'`);
  });

  it('invokes the suppression callback for all four affected paths', async () => {
    const suppressed: string[] = [];
    await renamePageFiles(
      {
        projectPath: tmpDir,
        oldPageName: 'home',
        newPageName: 'landing',
      },
      'legacy',
      (p) => suppressed.push(p)
    );

    expect(suppressed.sort()).toEqual(
      [
        path.join(tmpDir, 'home.tsx'),
        path.join(tmpDir, 'home.module.css'),
        path.join(tmpDir, 'landing.tsx'),
        path.join(tmpDir, 'landing.module.css'),
      ].sort()
    );
  });

  it('rejects when the new name already exists and leaves old files untouched', async () => {
    await fs.writeFile(path.join(tmpDir, 'about.tsx'), 'existing', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'about.module.css'),
      'existing',
      'utf-8'
    );

    await expect(
      renamePageFiles(
        {
          projectPath: tmpDir,
          oldPageName: 'home',
          newPageName: 'about',
        },
        'legacy'
      )
    ).rejects.toThrow(/already exists/);

    // Old files must still be present and unchanged.
    expect(await fs.readFile(path.join(tmpDir, 'home.tsx'), 'utf-8')).toBe(
      SOURCE_TSX
    );
    expect(
      await fs.readFile(path.join(tmpDir, 'home.module.css'), 'utf-8')
    ).toBe(SOURCE_CSS);
  });

  it('rejects when the old page is missing', async () => {
    await expect(
      renamePageFiles(
        {
          projectPath: tmpDir,
          oldPageName: 'missing',
          newPageName: 'landing',
        },
        'legacy'
      )
    ).rejects.toThrow(/Source page/);
    expect(await fs.readdir(tmpDir)).not.toContain('landing.tsx');
  });

  it('rejects when new === old', async () => {
    await expect(
      renamePageFiles(
        {
          projectPath: tmpDir,
          oldPageName: 'home',
          newPageName: 'home',
        },
        'legacy'
      )
    ).rejects.toThrow(/same as the old/);
  });

  it('rejects invalid page names', async () => {
    await expect(
      renamePageFiles(
        {
          projectPath: tmpDir,
          oldPageName: 'home',
          newPageName: 'Not Valid',
        },
        'legacy'
      )
    ).rejects.toThrow(/Invalid page name/);
  });

  it('rejects when the TSX has no matching CSS-module import', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'home.tsx'),
      `export default function Home() { return null; }`,
      'utf-8'
    );

    await expect(
      renamePageFiles(
        {
          projectPath: tmpDir,
          oldPageName: 'home',
          newPageName: 'landing',
        },
        'legacy'
      )
    ).rejects.toThrow(/CSS-module import/);

    const entries = await fs.readdir(tmpDir);
    expect(entries).not.toContain('landing.tsx');
    expect(entries).not.toContain('landing.module.css');
    expect(entries).toContain('home.tsx');
    expect(entries).toContain('home.module.css');
  });

  it('rejects when the default-export function signature does not match', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'home.tsx'),
      `import styles from './home.module.css';\nconst Home = () => null;\nexport default Home;\n`,
      'utf-8'
    );

    await expect(
      renamePageFiles(
        {
          projectPath: tmpDir,
          oldPageName: 'home',
          newPageName: 'landing',
        },
        'legacy'
      )
    ).rejects.toThrow(/default-export function/);

    const entries = await fs.readdir(tmpDir);
    expect(entries).not.toContain('landing.tsx');
    expect(entries).not.toContain('landing.module.css');
  });
});
