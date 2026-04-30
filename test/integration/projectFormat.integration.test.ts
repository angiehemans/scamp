import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { detectProjectFormat } from '../../src/main/ipc/projectFormat';

describe('detectProjectFormat', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-format-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects nextjs when app/page.tsx exists', async () => {
    await fs.mkdir(path.join(tmpDir, 'app'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'app', 'page.tsx'), '', 'utf-8');
    expect(await detectProjectFormat(tmpDir)).toBe('nextjs');
  });

  it('detects legacy when a tsx file exists at the project root', async () => {
    await fs.writeFile(path.join(tmpDir, 'home.tsx'), '', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'home.module.css'), '', 'utf-8');
    expect(await detectProjectFormat(tmpDir)).toBe('legacy');
  });

  it('treats an empty folder as nextjs (new project default)', async () => {
    expect(await detectProjectFormat(tmpDir)).toBe('nextjs');
  });

  it('prefers nextjs when both an app/ folder and a root tsx exist', async () => {
    // A half-migrated project — the app/ folder is the source of truth.
    await fs.mkdir(path.join(tmpDir, 'app'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'app', 'page.tsx'), '', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'home.tsx'), '', 'utf-8');
    expect(await detectProjectFormat(tmpDir)).toBe('nextjs');
  });

  it('falls back to nextjs when an app/ folder exists but contains no page.tsx', async () => {
    // An `app/` folder with no `page.tsx` isn't a valid nextjs project,
    // but it's also not legacy — without a tsx at the root we treat it
    // as a new/empty project.
    await fs.mkdir(path.join(tmpDir, 'app'), { recursive: true });
    expect(await detectProjectFormat(tmpDir)).toBe('nextjs');
  });
});
