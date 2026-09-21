import { describe, it, expect } from 'vitest';

import { applyRewrites, composeMaps, identityMap, sourceMapOf } from '@lib/sourceMap';

/** see docs/plans/incremental-writes-plan.md, phase 5 */

describe('identityMap', () => {
  it('leaves every offset where it is', () => {
    const map = identityMap();
    expect(map.toOriginalStart(0)).toBe(0);
    expect(map.toOriginalEnd(42)).toBe(42);
  });
});

describe('applyRewrites', () => {
  it('returns the source and an identity map when there is nothing to do', () => {
    const { text, map } = applyRewrites('hello', []);
    expect(text).toBe('hello');
    expect(map.toOriginalStart(3)).toBe(3);
  });

  it('applies one rewrite and maps offsets after it back', () => {
    const source = 'aaa{x}bbb';
    const { text, map } = applyRewrites(source, [{ start: 3, end: 6, text: '"LONGER"' }]);
    expect(text).toBe('aaa"LONGER"bbb');
    // Before the rewrite: unmoved.
    expect(map.toOriginalStart(0)).toBe(0);
    // After it: shifted back by the growth.
    expect(text.indexOf('bbb')).toBe(11);
    expect(map.toOriginalStart(11)).toBe(6);
    expect(source.slice(map.toOriginalStart(11))).toBe('bbb');
  });

  it('maps an offset inside a replaced region to that region in the original', () => {
    const { text, map } = applyRewrites('aaa{x}bbb', [{ start: 3, end: 6, text: '"LONGER"' }]);
    expect(text.slice(4, 8)).toBe('LONG');
    expect(map.toOriginalStart(4)).toBe(3);
    expect(map.toOriginalEnd(4)).toBe(6);
  });

  it('applies several rewrites and keeps later offsets exact', () => {
    const source = 'one {a} two {b} three';
    const { text, map } = applyRewrites(source, [
      { start: 4, end: 7, text: 'A' },
      { start: 12, end: 15, text: 'BBBBB' },
    ]);
    expect(text).toBe('one A two BBBBB three');
    const at = text.indexOf('three');
    expect(source.slice(map.toOriginalStart(at))).toBe('three');
  });

  it('sorts rewrites collected out of order', () => {
    const { text } = applyRewrites('one {a} two {b}', [
      { start: 12, end: 15, text: 'B' },
      { start: 4, end: 7, text: 'A' },
    ]);
    expect(text).toBe('one A two B');
  });

  it('handles a rewrite that shrinks the text', () => {
    const source = 'aaa{longer}bbb';
    const { text, map } = applyRewrites(source, [{ start: 3, end: 11, text: '<x>' }]);
    expect(text).toBe('aaa<x>bbb');
    expect(source.slice(map.toOriginalStart(text.indexOf('bbb')))).toBe('bbb');
  });

  it('handles a rewrite at the very start', () => {
    const source = '{a}rest';
    const { text, map } = applyRewrites(source, [{ start: 0, end: 3, text: '<tag>' }]);
    expect(source.slice(map.toOriginalStart(text.indexOf('rest')))).toBe('rest');
  });
});

describe('sourceMapOf', () => {
  it('treats an offset exactly at a region end as after it', () => {
    const map = sourceMapOf([{ start: 3, end: 8, origStart: 3, origEnd: 6 }]);
    expect(map.toOriginalStart(8)).toBe(6);
  });
});

describe('composeMaps', () => {
  it('maps a twice-rewritten text back to the original', () => {
    const original = 'keep {a} keep {b} keep';
    const first = applyRewrites(original, [{ start: 5, end: 8, text: '<one>' }]);
    const second = applyRewrites(first.text, [
      { start: first.text.indexOf('{b}'), end: first.text.indexOf('{b}') + 3, text: '<two-longer>' },
    ]);
    const map = composeMaps(first.map, second.map);
    const tail = second.text.lastIndexOf('keep');
    expect(original.slice(map.toOriginalStart(tail))).toBe('keep');
  });

  it('is the identity when neither pass changed anything', () => {
    const map = composeMaps(identityMap(), identityMap());
    expect(map.toOriginalStart(7)).toBe(7);
  });
});
