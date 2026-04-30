import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  createPage,
  deletePage,
  duplicatePage,
} from '../../src/main/ipc/pageOps';
import { scaffoldLegacyProject } from '../../src/main/ipc/projectScaffold';

describe('page operations — legacy format', () => {
  let projectDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-pageops-legacy-'));
    projectDir = path.join(tmp, 'my-project');
    await fs.mkdir(projectDir);
    await scaffoldLegacyProject(projectDir);
  });

  afterEach(async () => {
    await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
  });

  it('createPage writes <name>.tsx and <name>.module.css at the project root', async () => {
    const result = await createPage(
      { projectPath: projectDir, pageName: 'about' },
      'legacy'
    );
    expect(result.tsxPath).toBe(path.join(projectDir, 'about.tsx'));
    expect(result.cssPath).toBe(path.join(projectDir, 'about.module.css'));
    const tsx = await fs.readFile(result.tsxPath, 'utf-8');
    expect(tsx).toContain(`import styles from './about.module.css';`);
    expect(tsx).toContain('export default function About()');
  });

  it('createPage allows "home" as a name in legacy (legacy has no special-case)', async () => {
    // The legacy scaffold writes home.tsx, so trying to recreate it
    // collides on the existing files — but with a different message
    // path than the nextjs special-case "home" check.
    await expect(
      createPage({ projectPath: projectDir, pageName: 'home' }, 'legacy')
    ).rejects.toThrow(/already exists/);
  });

  it('deletePage removes both files', async () => {
    await createPage(
      { projectPath: projectDir, pageName: 'about' },
      'legacy'
    );
    await deletePage(
      { projectPath: projectDir, pageName: 'about' },
      'legacy'
    );
    const entries = await fs.readdir(projectDir);
    expect(entries).not.toContain('about.tsx');
    expect(entries).not.toContain('about.module.css');
  });

  it('deletePage allows deleting any page in legacy (no home special-case)', async () => {
    // The legacy delete handler is intentionally policy-light — the UI
    // owns the "minimum one page" guard.
    await deletePage(
      { projectPath: projectDir, pageName: 'home' },
      'legacy'
    );
    const entries = await fs.readdir(projectDir);
    expect(entries).not.toContain('home.tsx');
    expect(entries).not.toContain('home.module.css');
  });

  it('duplicatePage rewrites both the import line and the component name', async () => {
    const result = await duplicatePage(
      {
        projectPath: projectDir,
        sourcePageName: 'home',
        newPageName: 'home-copy',
      },
      'legacy'
    );
    const tsx = await fs.readFile(result.tsxPath, 'utf-8');
    expect(tsx).toContain(`import styles from './home-copy.module.css';`);
    expect(tsx).toContain('export default function HomeCopy()');
  });
});
