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

describe('file patch integration — media-scoped', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-patch-media-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a new @media block when none exists', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(cssPath, ORIGINAL, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(
      original,
      'rect_a1b2',
      'padding: 12px 12px 12px 12px;',
      { maxWidth: 768 }
    );
    await fs.writeFile(cssPath, next, 'utf-8');

    const result = await fs.readFile(cssPath, 'utf-8');
    expect(result).toContain('@media (max-width: 768px)');
    expect(result).toContain('padding: 12px 12px 12px 12px');
    // Base class untouched.
    expect(result).toContain('background: red;');
    expect(result).toContain('width: 100px;');
  });

  it('patches an existing class rule inside a matching @media block', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    const source = `${ORIGINAL}
@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 8px 8px 8px 8px;
  }
}
`;
    await fs.writeFile(cssPath, source, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(
      original,
      'rect_a1b2',
      'padding: 16px 16px 16px 16px;',
      { maxWidth: 768 }
    );
    await fs.writeFile(cssPath, next, 'utf-8');

    const result = await fs.readFile(cssPath, 'utf-8');
    expect(result).toContain('padding: 16px 16px 16px 16px');
    expect(result).not.toContain('padding: 8px 8px 8px 8px');
    // Base class still intact.
    expect(result).toContain('background: red;');
  });

  it('appends a new class rule inside an existing @media block', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    const source = `${ORIGINAL}
@media (max-width: 768px) {
  .rect_c3d4 {
    width: 100%;
  }
}
`;
    await fs.writeFile(cssPath, source, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(
      original,
      'rect_a1b2',
      'padding: 12px;',
      { maxWidth: 768 }
    );
    await fs.writeFile(cssPath, next, 'utf-8');

    const result = await fs.readFile(cssPath, 'utf-8');
    // Both class rules exist inside the single @media block.
    expect(result).toContain('.rect_c3d4');
    expect(result).toContain('width: 100%');
    expect(result).toContain('.rect_a1b2');
    expect(result).toContain('padding: 12px');
    // Only one @media block.
    expect((result.match(/@media \(max-width: 768px\)/g) ?? []).length).toBe(1);
  });

  it('does not touch the base class when patching media-scoped', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(cssPath, ORIGINAL, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(
      original,
      'rect_a1b2',
      'padding: 8px;',
      { maxWidth: 390 }
    );
    const result = next;
    // Base class's `background: red` stays put.
    expect(result).toContain('background: red;');
    expect(result).toContain('width: 100px;');
    // Media block added.
    expect(result).toContain('@media (max-width: 390px)');
  });

  it('clears an empty media-scoped declaration body and drops the rule', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    const source = `${ORIGINAL}
@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
  .rect_c3d4 {
    width: 100%;
  }
}
`;
    await fs.writeFile(cssPath, source, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(original, 'rect_a1b2', '', { maxWidth: 768 });
    // rect_a1b2 rule gone from the media block; rect_c3d4 still there.
    expect(next).toContain('@media (max-width: 768px)');
    expect(next).toContain('.rect_c3d4');
    expect(next).toContain('width: 100%');
    expect(next).not.toMatch(/\.rect_a1b2\s*\{[^}]*padding/);
  });

  it('removes the @media block when clearing its only class rule', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    const source = `${ORIGINAL}
@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
}
`;
    await fs.writeFile(cssPath, source, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(original, 'rect_a1b2', '', { maxWidth: 768 });
    expect(next).not.toContain('@media (max-width: 768px)');
    // Base class untouched.
    expect(next).toContain('background: red;');
  });

  it('does not confuse two media queries with different widths', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    const source = `${ORIGINAL}
@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
}

@media (max-width: 390px) {
  .rect_a1b2 {
    padding: 8px;
  }
}
`;
    await fs.writeFile(cssPath, source, 'utf-8');

    const original = await fs.readFile(cssPath, 'utf-8');
    const next = patchClassBlock(
      original,
      'rect_a1b2',
      'padding: 20px;',
      { maxWidth: 768 }
    );
    // 768 got updated, 390 stayed.
    expect(next).toMatch(/max-width: 768px\)[\s\S]*padding: 20px/);
    expect(next).toMatch(/max-width: 390px\)[\s\S]*padding: 8px/);
  });
});
