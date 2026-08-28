import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import {
  hasProjectThumbnail,
  MAX_THUMBNAIL_BYTES,
  readProjectThumbnail,
  thumbnailPathFor,
  writeProjectThumbnail,
} from '../src/main/ipc/projectThumbnailOps';

/**
 * Real temp dirs, no fs mocking — these are twenty lines of file handling
 * whose interesting cases are all about what is already on disk.
 */

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-thumb-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/** A one-pixel PNG, as a data URL. */
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('writeProjectThumbnail', () => {
  it('writes the decoded png under .scamp/', async () => {
    const result = await writeProjectThumbnail({
      projectPath: dir,
      dataUrl: PNG_DATA_URL,
    });
    expect(result).toEqual({
      ok: true,
      thumbnailPath: path.join(dir, '.scamp', 'preview.png'),
    });
    const written = await fs.readFile(path.join(dir, '.scamp', 'preview.png'));
    // The PNG magic number — proof it decoded rather than storing base64.
    expect([...written.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('creates .scamp when the project has never had one', async () => {
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    const stat = await fs.stat(path.join(dir, '.scamp'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('overwrites the previous thumbnail rather than accumulating files', async () => {
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    expect(await fs.readdir(path.join(dir, '.scamp'))).toEqual(['preview.png']);
  });

  it('rejects a data url with no comma', async () => {
    const result = await writeProjectThumbnail({
      projectPath: dir,
      dataUrl: 'not-a-data-url',
    });
    expect(result).toEqual({ ok: false, error: 'Malformed data URL' });
  });

  it('rejects an empty payload rather than writing a zero-byte png', async () => {
    // A zero-byte file reads back as a broken image, which is worse than
    // no image at all — the card would show a broken-image glyph.
    const result = await writeProjectThumbnail({
      projectPath: dir,
      dataUrl: 'data:image/png;base64,',
    });
    expect(result.ok).toBe(false);
    expect(await hasProjectThumbnail(dir)).toBe(false);
  });

  it('refuses a payload far larger than a cropped thumbnail can be', async () => {
    // The renderer crops to 640px before sending, so this size means
    // something upstream is broken. Writing it would put megabytes in the
    // user's project folder on every save.
    const huge = Buffer.alloc(MAX_THUMBNAIL_BYTES + 1).toString('base64');
    const result = await writeProjectThumbnail({
      projectPath: dir,
      dataUrl: `data:image/png;base64,${huge}`,
    });
    expect(result.ok).toBe(false);
    expect(await hasProjectThumbnail(dir)).toBe(false);
  });

  it('reports a write into a directory that does not exist', async () => {
    const result = await writeProjectThumbnail({
      projectPath: path.join(dir, 'no', 'such', '\0bad'),
      dataUrl: PNG_DATA_URL,
    });
    expect(result.ok).toBe(false);
  });
});

describe('readProjectThumbnail', () => {
  it('returns the file as base64 with no data url prefix', async () => {
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    const result = await readProjectThumbnail({ projectPath: dir });
    expect(result.base64).toBe(PNG_DATA_URL.split(',')[1]);
  });

  it('returns null for a project with no thumbnail', async () => {
    // The normal case for any project that predates this feature.
    expect(await readProjectThumbnail({ projectPath: dir })).toEqual({
      base64: null,
    });
  });

  it('returns null for a project folder that is gone', async () => {
    expect(
      await readProjectThumbnail({ projectPath: path.join(dir, 'missing') })
    ).toEqual({ base64: null });
  });

  it('round-trips what was written', async () => {
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    const { base64 } = await readProjectThumbnail({ projectPath: dir });
    if (base64 === null) throw new Error('expected a thumbnail');
    const rewritten = await writeProjectThumbnail({
      projectPath: dir,
      dataUrl: `data:image/png;base64,${base64}`,
    });
    expect(rewritten.ok).toBe(true);
    expect((await readProjectThumbnail({ projectPath: dir })).base64).toBe(
      base64
    );
  });
});

describe('hasProjectThumbnail', () => {
  it('is false before anything is written', async () => {
    expect(await hasProjectThumbnail(dir)).toBe(false);
  });

  it('is true once a thumbnail exists', async () => {
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    expect(await hasProjectThumbnail(dir)).toBe(true);
  });

  it('is false for a project folder that does not exist', async () => {
    expect(await hasProjectThumbnail(path.join(dir, 'missing'))).toBe(false);
  });

  it('agrees with the path the writer used', async () => {
    await writeProjectThumbnail({ projectPath: dir, dataUrl: PNG_DATA_URL });
    await fs.access(thumbnailPathFor(dir));
  });
});
