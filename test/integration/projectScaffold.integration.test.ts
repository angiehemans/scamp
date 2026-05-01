import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  readProjectLegacy,
  readProjectNextjs,
  scaffoldLegacyProject,
  scaffoldNextjsProject,
  themePathFor,
} from '../../src/main/ipc/projectScaffold';
import { detectProjectFormat } from '../../src/main/ipc/projectFormat';
import { generateCode } from '../../src/renderer/lib/generateCode';
import { parseCode } from '../../src/renderer/lib/parseCode';
import { ROOT_ELEMENT_ID, type ScampElement } from '../../src/renderer/lib/element';
import { DEFAULT_RECT_STYLES } from '../../src/renderer/lib/defaults';

const makeRoot = (): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds: [],
  widthMode: 'stretch',
  heightMode: 'auto',
  minHeight: '100vh',
  x: 0,
  y: 0,
  position: 'auto',
  customProperties: {},
  inlineFragments: [],
  transitions: [],
});

describe('scaffoldNextjsProject', () => {
  let projectDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-nextjs-'));
    projectDir = path.join(tmp, 'my-project');
    await fs.mkdir(projectDir);
  });

  afterEach(async () => {
    await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
  });

  it('writes the expected file tree', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');

    const list = async (rel: string): Promise<string[]> => {
      const dir = path.join(projectDir, rel);
      const entries = await fs.readdir(dir);
      return entries.sort();
    };

    expect(await list('')).toEqual([
      'agent.md',
      'app',
      'next.config.ts',
      'package.json',
      'public',
    ]);
    expect(await list('app')).toEqual([
      'layout.tsx',
      'page.module.css',
      'page.tsx',
      'theme.css',
    ]);
    expect(await list('public')).toEqual(['assets']);
    expect(await list('public/assets')).toEqual([]);
  });

  it('emits a Home component in app/page.tsx that imports ./page.module.css', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    const tsx = await fs.readFile(
      path.join(projectDir, 'app', 'page.tsx'),
      'utf-8'
    );
    expect(tsx).toContain(`import styles from './page.module.css';`);
    expect(tsx).toContain('export default function Home()');
  });

  it('imports theme.css from app/layout.tsx so next dev applies the tokens', async () => {
    // The whole reason we co-located theme.css inside app/ — the root
    // layout has to actually pull it in.
    await scaffoldNextjsProject(projectDir, 'my-project');
    const layout = await fs.readFile(
      path.join(projectDir, 'app', 'layout.tsx'),
      'utf-8'
    );
    expect(layout).toContain(`import './theme.css';`);
  });

  it('writes a package.json with pinned next/react dependencies', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    const raw = await fs.readFile(
      path.join(projectDir, 'package.json'),
      'utf-8'
    );
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.name).toBe('my-project');
    const deps = parsed.dependencies as Record<string, string>;
    expect(deps.next).toMatch(/^\^\d/);
    expect(deps.react).toMatch(/^\^\d/);
    expect(deps['react-dom']).toMatch(/^\^\d/);
  });

  it('produces a project that detectProjectFormat reads as nextjs', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    expect(await detectProjectFormat(projectDir)).toBe('nextjs');
  });

  it('readProjectNextjs picks up the home page', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    const pages = await readProjectNextjs(projectDir);
    expect(pages.map((p) => p.name)).toEqual(['home']);
    expect(pages[0]?.tsxPath).toBe(
      path.join(projectDir, 'app', 'page.tsx')
    );
  });

  it('readProjectNextjs picks up additional pages in app/<name>/', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    // Simulate what page:create will eventually do for nextjs.
    const aboutDir = path.join(projectDir, 'app', 'about');
    await fs.mkdir(aboutDir);
    await fs.writeFile(
      path.join(aboutDir, 'page.tsx'),
      `import styles from './page.module.css';\nexport default function About() {\n  return <div data-scamp-id="root" className={styles.root} />;\n}\n`,
      'utf-8'
    );
    await fs.writeFile(
      path.join(aboutDir, 'page.module.css'),
      '.root {}\n',
      'utf-8'
    );
    const pages = await readProjectNextjs(projectDir);
    expect(pages.map((p) => p.name).sort()).toEqual(['about', 'home']);
  });

  it('skips folders missing a page.tsx (e.g. agent leftover dirs)', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    await fs.mkdir(path.join(projectDir, 'app', 'orphan'));
    const pages = await readProjectNextjs(projectDir);
    expect(pages.map((p) => p.name)).toEqual(['home']);
  });

  it('round-trips through generateCode → file → parseCode for the home page', async () => {
    await scaffoldNextjsProject(projectDir, 'my-project');
    const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
    const code = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      cssModuleImportName: 'page',
    });
    await fs.writeFile(
      path.join(projectDir, 'app', 'page.tsx'),
      code.tsx,
      'utf-8'
    );
    await fs.writeFile(
      path.join(projectDir, 'app', 'page.module.css'),
      code.css,
      'utf-8'
    );
    const tsx = await fs.readFile(
      path.join(projectDir, 'app', 'page.tsx'),
      'utf-8'
    );
    const css = await fs.readFile(
      path.join(projectDir, 'app', 'page.module.css'),
      'utf-8'
    );
    const parsed = parseCode(tsx, css);
    expect(parsed.rootId).toBe(ROOT_ELEMENT_ID);
    expect(parsed.elements[ROOT_ELEMENT_ID]).toBeDefined();
  });
});

describe('scaffoldLegacyProject', () => {
  let projectDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-legacy-'));
    projectDir = path.join(tmp, 'my-project');
    await fs.mkdir(projectDir);
  });

  afterEach(async () => {
    await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
  });

  it('writes the flat layout', async () => {
    await scaffoldLegacyProject(projectDir);
    const entries = (await fs.readdir(projectDir)).sort();
    expect(entries).toEqual([
      'agent.md',
      'home.module.css',
      'home.tsx',
      'theme.css',
    ]);
  });

  it('imports ./home.module.css from home.tsx', async () => {
    await scaffoldLegacyProject(projectDir);
    const tsx = await fs.readFile(
      path.join(projectDir, 'home.tsx'),
      'utf-8'
    );
    expect(tsx).toContain(`import styles from './home.module.css';`);
  });

  it('produces a project that detectProjectFormat reads as legacy', async () => {
    await scaffoldLegacyProject(projectDir);
    expect(await detectProjectFormat(projectDir)).toBe('legacy');
  });

  it('readProjectLegacy picks up the home page', async () => {
    await scaffoldLegacyProject(projectDir);
    const pages = await readProjectLegacy(projectDir);
    expect(pages.map((p) => p.name)).toEqual(['home']);
  });
});

describe('themePathFor', () => {
  it('uses app/theme.css for nextjs projects', () => {
    expect(themePathFor('/p', 'nextjs')).toBe(path.join('/p', 'app', 'theme.css'));
  });

  it('uses theme.css at the project root for legacy projects', () => {
    expect(themePathFor('/p', 'legacy')).toBe(path.join('/p', 'theme.css'));
  });
});
