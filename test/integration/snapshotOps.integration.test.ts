import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  readSnapshotPage,
  restoreSnapshot,
} from '../../src/main/ipc/snapshotOps';
import {
  scaffoldLegacyProject,
  scaffoldNextjsProject,
} from '../../src/main/ipc/projectScaffold';

// Real scaffolded projects on a temp dir; no mocking. Mirrors the existing
// pageOps / componentOps integration-test convention.

describe('snapshot operations — nextjs format', () => {
  let projectDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-snap-nextjs-'));
    projectDir = path.join(tmp, 'my-project');
    await fs.mkdir(projectDir, { recursive: true });
    await scaffoldNextjsProject(projectDir, 'my-project');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
  });

  it('captures the scaffolded page files into .scamp/snapshots/<id>/', async () => {
    const snap = await createSnapshot(projectDir, 'nextjs', 'session_open');
    expect(snap).not.toBeNull();
    expect(snap?.pageCount).toBeGreaterThanOrEqual(1);

    const snapDir = path.join(projectDir, '.scamp', 'snapshots', snap!.id);
    const liveHome = await fs.readFile(
      path.join(projectDir, 'app', 'page.tsx'),
      'utf-8'
    );
    const snapHome = await fs.readFile(
      path.join(snapDir, 'app', 'page.tsx'),
      'utf-8'
    );
    expect(snapHome).toBe(liveHome);

    const index = JSON.parse(
      await fs.readFile(
        path.join(projectDir, '.scamp', 'snapshots.json'),
        'utf-8'
      )
    );
    expect(index.snapshots.map((s: { id: string }) => s.id)).toContain(snap!.id);
  });

  it('round-trips a restore: mutate → restore → files match the snapshot', async () => {
    const homePath = path.join(projectDir, 'app', 'page.tsx');
    const original = await fs.readFile(homePath, 'utf-8');

    const snap = await createSnapshot(projectDir, 'nextjs', 'manual', 'good');
    await fs.writeFile(homePath, '// clobbered externally');

    const res = await restoreSnapshot(projectDir, 'nextjs', snap!.id);
    expect(res.ok).toBe(true);
    expect(await fs.readFile(homePath, 'utf-8')).toBe(original);

    // The restore captured the clobbered state as a before_restore snapshot.
    const list = await listSnapshots(projectDir);
    expect(list.some((s) => s.trigger === 'before_restore')).toBe(true);
  });

  it('models the trigger timeline: open + rapid agent edits (collapsed) + close', async () => {
    // The watcher / lifecycle hooks call createSnapshot with these
    // triggers; this asserts the resulting snapshot timeline.
    const t0 = Date.parse('2026-05-01T10:00:00.000Z');
    await createSnapshot(projectDir, 'nextjs', 'session_open', undefined, t0);
    await createSnapshot(projectDir, 'nextjs', 'agent_edit', 'page.tsx', t0 + 1000);
    // Second agent edit <5s later collapses into the first — no new snapshot.
    await createSnapshot(
      projectDir,
      'nextjs',
      'agent_edit',
      'page.module.css',
      t0 + 2000
    );
    await createSnapshot(projectDir, 'nextjs', 'session_close', undefined, t0 + 10000);

    const list = await listSnapshots(projectDir);
    expect(list.map((s) => s.trigger)).toEqual([
      'session_open',
      'agent_edit',
      'session_close',
    ]);
    expect(list[1]?.label).toBe('External edit — page.tsx');
  });

  it('reads a page from a snapshot without restoring (preview path)', async () => {
    const homeTsx = path.join(projectDir, 'app', 'page.tsx');
    const homeCss = path.join(projectDir, 'app', 'page.module.css');
    const originalTsx = await fs.readFile(homeTsx, 'utf-8');

    const snap = await createSnapshot(projectDir, 'nextjs', 'manual', 'pre');
    // Mutate the live files AFTER the snapshot — the read must return the
    // snapshot's content, and disk must stay clobbered (no restore).
    await fs.writeFile(homeTsx, '// live edit');

    const read = await readSnapshotPage(projectDir, snap!.id, homeTsx, homeCss);
    expect(read.tsx).toBe(originalTsx);
    expect(read.css).not.toBeNull();
    // The live file is untouched — preview is read-only.
    expect(await fs.readFile(homeTsx, 'utf-8')).toBe('// live edit');
  });

  it('returns null for a page the snapshot does not contain', async () => {
    const snap = await createSnapshot(projectDir, 'nextjs', 'manual', 'pre');
    const ghostTsx = path.join(projectDir, 'app', 'ghost', 'page.tsx');
    const ghostCss = path.join(projectDir, 'app', 'ghost', 'page.module.css');

    const read = await readSnapshotPage(projectDir, snap!.id, ghostTsx, ghostCss);
    expect(read).toEqual({ tsx: null, css: null });
  });

  it('lists newest-appended and supports delete', async () => {
    const a = await createSnapshot(projectDir, 'nextjs', 'manual', 'one');
    const b = await createSnapshot(projectDir, 'nextjs', 'manual', 'two');
    let list = await listSnapshots(projectDir);
    expect(list.map((s) => s.id)).toEqual([a!.id, b!.id]);

    await deleteSnapshot(projectDir, a!.id);
    list = await listSnapshots(projectDir);
    expect(list.map((s) => s.id)).toEqual([b!.id]);
  });
});

describe('snapshot operations — legacy format', () => {
  let projectDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-snap-legacy-'));
    projectDir = path.join(tmp, 'my-project');
    await fs.mkdir(projectDir, { recursive: true });
    await scaffoldLegacyProject(projectDir);
  });

  afterEach(async () => {
    await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
  });

  it('captures the flat root page files', async () => {
    const snap = await createSnapshot(projectDir, 'legacy', 'session_open');
    expect(snap).not.toBeNull();

    const snapDir = path.join(projectDir, '.scamp', 'snapshots', snap!.id);
    const liveHome = await fs.readFile(
      path.join(projectDir, 'home.tsx'),
      'utf-8'
    );
    const snapHome = await fs.readFile(
      path.join(snapDir, 'home.tsx'),
      'utf-8'
    );
    expect(snapHome).toBe(liveHome);
  });
});
