import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { atomicWrite } from '../src/main/ipc/fileOps';

describe('atomicWrite', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-ops-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true });
  });

  it('writes the content to the target path', async () => {
    const target = path.join(dir, 'page.tsx');
    await atomicWrite(target, 'hello');
    expect(await fs.readFile(target, 'utf-8')).toBe('hello');
  });

  it('overwrites existing content', async () => {
    const target = path.join(dir, 'home.module.css');
    await atomicWrite(target, 'first');
    await atomicWrite(target, 'second');
    expect(await fs.readFile(target, 'utf-8')).toBe('second');
  });

  it('leaves no .tmp file behind after a successful write', async () => {
    await atomicWrite(path.join(dir, 'a.tsx'), 'x');
    const leftover = (await fs.readdir(dir)).filter((f) => f.endsWith('.tmp'));
    expect(leftover).toEqual([]);
  });
});
