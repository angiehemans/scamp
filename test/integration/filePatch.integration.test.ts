import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { patchClassBlock } from '@shared/patchClass';

const ORIGINAL = `.root {
  width: 1440px;
  height: 900px;
  position: relative;
}

.rect_a1b2 {
  background: red;
  width: 100px;
  height: 100px;
}

.rect_c3d4 {
  background: blue;
  width: 50px;
  height: 50px;
}
`;

describe('file patch integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-patch-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('replaces only the target class block and leaves others untouched', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(cssPath, ORIGINAL, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(original, 'rect_a1b2', `background: green;\nwidth: 200px;`);
    await fs.writeFile(cssPath, next, 'utf-8');

    const result = await fs.readFile(cssPath, 'utf-8');
    expect(result).toContain('.rect_a1b2');
    expect(result).toContain('background: green;');
    expect(result).toContain('width: 200px;');
    expect(result).not.toContain('background: red;');
    // Other classes untouched
    expect(result).toContain('.rect_c3d4');
    expect(result).toContain('background: blue;');
    expect(result).toContain('.root');
    expect(result).toContain('width: 1440px;');
  });

  it('appends a new class block when the class does not yet exist', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(cssPath, ORIGINAL, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(original, 'rect_e5f6', `background: yellow;`);
    await fs.writeFile(cssPath, next, 'utf-8');

    const result = await fs.readFile(cssPath, 'utf-8');
    expect(result).toContain('.rect_e5f6');
    expect(result).toContain('background: yellow;');
    // Original blocks intact
    expect(result).toContain('.rect_a1b2');
    expect(result).toContain('.rect_c3d4');
  });

  it('handles an empty declaration body by clearing the block', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(cssPath, ORIGINAL, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(original, 'rect_a1b2', '');
    await fs.writeFile(cssPath, next, 'utf-8');

    const result = await fs.readFile(cssPath, 'utf-8');
    expect(result).toContain('.rect_a1b2');
    expect(result).not.toContain('background: red;');
    expect(result).toContain('.rect_c3d4');
  });
});
