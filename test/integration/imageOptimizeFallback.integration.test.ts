import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

/**
 * What happens when the codecs can't load at all.
 *
 * `imageOptimize` is reached from `main/index.ts` via
 * `registerImageIpc`, so a throw at import time would stop the app
 * launching. Compression is a nice-to-have; launching is not.
 * see docs/plans/image-optimization-plan.md
 */

// Make the WebP encoder fail to load, as a corrupt or partial install
// would. Any one codec failing takes the whole optimizer offline.
vi.mock('@jsquash/webp/encode', () => {
  throw new Error('failed to load wasm codec');
});

const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d' +
    '4944415478da63f8cfc0f01f00050001ff5ca2bf430000000049454e44ae426082',
  'hex'
);

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-nocodec-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('when the codecs are unavailable', () => {
  it('returns null from the optimizer instead of throwing', async () => {
    const { toWebpIfSmaller } = await import('../../src/main/ipc/imageOptimize');
    const src = path.join(dir, 'hero.png');
    await fs.writeFile(src, PNG_1X1);
    expect(await toWebpIfSmaller(src)).toBeNull();
  });

  it('still imports the image, just uncompressed', async () => {
    // The property that matters: the feature degrades to the behaviour
    // from before it existed, rather than breaking image import.
    const { copyImage } = await import('../../src/main/ipc/imageOps');
    const project = path.join(dir, 'project');
    await fs.mkdir(project);
    const src = path.join(dir, 'hero.png');
    await fs.writeFile(src, PNG_1X1);

    const result = await copyImage(
      { sourcePath: src, projectPath: project },
      'legacy'
    );
    expect(result.fileName).toBe('hero.png');
    expect(result.relativePath).toBe('./assets/hero.png');
    const written = await fs.readFile(path.join(project, 'assets', 'hero.png'));
    expect(written.equals(PNG_1X1)).toBe(true);
  });
});
