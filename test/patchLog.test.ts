import { describe, it, expect, vi } from 'vitest';

import { createPatchLog, hunksFor, type PatchEntry } from '@lib/patchLog';
import { diffText } from '@lib/textEdits';

/** see docs/plans/incremental-writes-plan.md, phase 6 */

const BASE = `one
two
three
four
`;

const entry = (target: string, edits = [{ start: 0, end: 3, replacement: 'ONE' }]): Omit<PatchEntry, 'revision'> => ({
  at: 1,
  target,
  kind: 'page',
  files: [{ file: 'tsx', path: `${target}.tsx`, hunks: [], edits }],
});

describe('hunksFor', () => {
  it('numbers a one-line change from line 1', () => {
    const edits = diffText(BASE, BASE.replace('one', 'ONE'));
    expect(hunksFor(BASE, edits)).toEqual([
      { line: 1, removed: 1, added: 1, text: 'ONE\n' },
    ]);
  });

  it('numbers a change in the middle by its line in the old file', () => {
    const edits = diffText(BASE, BASE.replace('three', 'THREE'));
    expect(hunksFor(BASE, edits)).toEqual([
      { line: 3, removed: 1, added: 1, text: 'THREE\n' },
    ]);
  });

  it('counts an insertion as adding without removing', () => {
    const edits = diffText(BASE, BASE.replace('two\n', 'two\ntwo-and-a-half\n'));
    const hunks = hunksFor(BASE, edits);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toBe(0);
    expect(hunks[0]?.added).toBe(1);
  });

  it('counts a deletion as removing without adding', () => {
    const edits = diffText(BASE, BASE.replace('two\n', ''));
    expect(hunksFor(BASE, edits)).toEqual([
      { line: 2, removed: 1, added: 0, text: '' },
    ]);
  });

  it('reports each disjoint region separately', () => {
    const edits = diffText(BASE, BASE.replace('one', 'ONE').replace('four', 'FOUR'));
    const hunks = hunksFor(BASE, edits);
    expect(hunks.map((h) => h.line)).toEqual([1, 4]);
  });

  it('returns nothing for no edits', () => {
    expect(hunksFor(BASE, [])).toEqual([]);
  });
});

describe('createPatchLog', () => {
  it('starts empty at revision 0', () => {
    const log = createPatchLog();
    expect(log.revision()).toBe(0);
    expect(log.entries()).toEqual([]);
  });

  it('numbers patches from 1, in order', () => {
    const log = createPatchLog();
    expect(log.record(entry('home'))?.revision).toBe(1);
    expect(log.record(entry('about'))?.revision).toBe(2);
    expect(log.revision()).toBe(2);
  });

  it('ignores a patch with no edits in any file', () => {
    const log = createPatchLog();
    expect(log.record(entry('home', []))).toBeNull();
    expect(log.revision()).toBe(0);
  });

  it('drops files that did not change', () => {
    const log = createPatchLog();
    const recorded = log.record({
      at: 1,
      target: 'home',
      kind: 'page',
      files: [
        { file: 'tsx', path: 'home.tsx', hunks: [], edits: [] },
        { file: 'css', path: 'home.module.css', hunks: [], edits: [{ start: 0, end: 1, replacement: 'x' }] },
      ],
    });
    expect(recorded?.files.map((f) => f.file)).toEqual(['css']);
  });

  it('returns only what came after a revision', () => {
    const log = createPatchLog();
    log.record(entry('a'));
    const second = log.record(entry('b'));
    log.record(entry('c'));
    expect(log.since(second?.revision ?? 0).map((e) => e.target)).toEqual(['c']);
  });

  it('returns everything for revision 0', () => {
    const log = createPatchLog();
    log.record(entry('a'));
    log.record(entry('b'));
    expect(log.since(0)).toHaveLength(2);
  });

  it('returns nothing for a revision past the end', () => {
    const log = createPatchLog();
    log.record(entry('a'));
    expect(log.since(99)).toEqual([]);
  });

  it('keeps only the most recent entries, and keeps numbering past them', () => {
    const log = createPatchLog(2);
    log.record(entry('a'));
    log.record(entry('b'));
    log.record(entry('c'));
    expect(log.entries().map((e) => e.target)).toEqual(['b', 'c']);
    expect(log.revision()).toBe(3);
  });

  it('tells subscribers about each patch', () => {
    const log = createPatchLog();
    const seen: string[] = [];
    log.subscribe((e) => seen.push(e.target));
    log.record(entry('a'));
    log.record(entry('b'));
    expect(seen).toEqual(['a', 'b']);
  });

  it('stops telling a subscriber that unsubscribed', () => {
    const log = createPatchLog();
    const listener = vi.fn();
    const off = log.subscribe(listener);
    log.record(entry('a'));
    off();
    log.record(entry('b'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('records the patch even when a subscriber throws', () => {
    const log = createPatchLog();
    log.subscribe(() => {
      throw new Error('subscriber is broken');
    });
    expect(log.record(entry('a'))?.revision).toBe(1);
    expect(log.entries()).toHaveLength(1);
  });

  it('clears the entries but not the revision counter', () => {
    const log = createPatchLog();
    log.record(entry('a'));
    log.clear();
    expect(log.entries()).toEqual([]);
    expect(log.record(entry('b'))?.revision).toBe(2);
  });
});
