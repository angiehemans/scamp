import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * Phase 6 of docs/plans/incremental-writes-plan.md: every save lands in
 * the patch stream, in the units the save wrote. This proves the stream
 * is fed by the real save path, not only by its unit tests.
 */

type PatchEntry = {
  revision: number;
  at: number;
  target: string;
  kind: string;
  files: Array<{
    file: string;
    path: string;
    hunks: Array<{ line: number; removed: number; added: number; text: string }>;
    edits: Array<{ start: number; end: number; replacement: string }>;
  }>;
};

const patches = (
  window: Parameters<typeof pageRoot>[0],
  since = 0
): Promise<PatchEntry[]> =>
  window.evaluate(
    (from) =>
      (globalThis as unknown as { __scampPatches: (s?: number) => PatchEntry[] }).__scampPatches(
        from
      ),
    since
  ) as Promise<PatchEntry[]>;

test('a canvas edit becomes a patch with the file, the line, and the text', async ({
  window,
}) => {
  await expect(pageRoot(window)).toBeVisible();

  // The first save of a target has no base to diff against; the second
  // is the one that produces a patch.
  await selectTool(window, 'r');
  await dragInFrame(window, { x: 80, y: 80 }, { x: 260, y: 200 });
  await waitForSaved(window);
  await selectTool(window, 'r');
  await dragInFrame(window, { x: 320, y: 80 }, { x: 500, y: 200 });
  await waitForSaved(window);

  const entries = await patches(window);
  expect(entries.length).toBeGreaterThan(0);

  const latest = entries[entries.length - 1];
  expect(latest?.target.length).toBeGreaterThan(0);
  expect(latest?.kind).toBe('page');
  // Revisions are monotonic.
  expect(entries.map((e) => e.revision)).toEqual(
    [...entries.map((e) => e.revision)].sort((a, b) => a - b)
  );

  // Drawing a rectangle writes to both files, and the paths are
  // project-relative — nothing here should carry a home directory.
  const files = latest?.files ?? [];
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    expect(file.path.startsWith('/')).toBe(false);
    expect(file.hunks.length).toBeGreaterThan(0);
    expect(file.hunks[0]?.line).toBeGreaterThan(0);
    expect(file.edits.length).toBe(file.hunks.length);
  }
});

test('asking for what came after a revision returns only that', async ({ window }) => {
  await expect(pageRoot(window)).toBeVisible();
  await selectTool(window, 'r');
  await dragInFrame(window, { x: 80, y: 80 }, { x: 260, y: 200 });
  await waitForSaved(window);
  await selectTool(window, 'r');
  await dragInFrame(window, { x: 320, y: 80 }, { x: 500, y: 200 });
  await waitForSaved(window);

  const before = await patches(window);
  const mark = before[before.length - 1]?.revision ?? 0;
  expect(await patches(window, mark)).toEqual([]);

  await selectTool(window, 'r');
  await dragInFrame(window, { x: 80, y: 260 }, { x: 260, y: 380 });
  await waitForSaved(window);

  const after = await patches(window, mark);
  expect(after.length).toBeGreaterThan(0);
  expect(after.every((e) => e.revision > mark)).toBe(true);
});
