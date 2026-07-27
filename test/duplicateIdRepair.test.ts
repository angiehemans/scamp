import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { ROOT_ELEMENT_ID } from '@lib/element';

/**
 * When a page has two elements sharing a `data-scamp-id`, parseCode
 * reassigns the LATER one a fresh id (keeping both elements and their
 * styling) and reports the repair. Deterministic so the round-trip stays
 * stable. see docs/notes/duplicate-id-repair.md
 */

const DUP_TSX = `<div data-scamp-id="root" className={styles.root}>
  <div data-scamp-id="rect_1a2b" className={styles.rect_1a2b}></div>
  <div data-scamp-id="rect_1a2b" className={styles.rect_1a2b}></div>
</div>`;

const DUP_CSS = `.root {}
.rect_1a2b {
  width: 120px;
  height: 40px;
  background: #ff0000;
}`;

const shortOf = (cls: string): string =>
  cls.includes('_') ? cls.slice(cls.lastIndexOf('_') + 1) : cls;

describe('parseCode — duplicate id repair', () => {
  it('reassigns the later duplicate a fresh id, keeping both elements', () => {
    const { elements } = parseCode(DUP_TSX, DUP_CSS);
    const root = elements[ROOT_ELEMENT_ID];
    expect(root).toBeDefined();
    // Two distinct children under root.
    expect(root?.childIds).toHaveLength(2);
    expect(new Set(root?.childIds).size).toBe(2);
    // Original id survives; a second, distinct element exists.
    expect(elements['1a2b']).toBeDefined();
    const ids = Object.keys(elements).filter((id) => id !== ROOT_ELEMENT_ID);
    expect(ids).toHaveLength(2);
  });

  it('reports the repair as { from, to }', () => {
    const { duplicateIdRepairs } = parseCode(DUP_TSX, DUP_CSS);
    expect(duplicateIdRepairs).toBeDefined();
    expect(duplicateIdRepairs).toHaveLength(1);
    expect(duplicateIdRepairs?.[0]?.from).toBe('rect_1a2b');
    expect(duplicateIdRepairs?.[0]?.to).toMatch(/^rect_[0-9a-f]{4}$/);
    // The new class isn't the old one.
    expect(duplicateIdRepairs?.[0]?.to).not.toBe('rect_1a2b');
  });

  it('preserves the repaired copy\'s styling (sourced from the original class)', () => {
    const { elements, duplicateIdRepairs } = parseCode(DUP_TSX, DUP_CSS);
    const original = elements['1a2b'];
    const newId = shortOf(duplicateIdRepairs![0]!.to);
    const repaired = elements[newId];
    expect(repaired).toBeDefined();
    // Same typed styles as the original — a true copy, not a blank box.
    expect(repaired?.widthValue).toBe(original?.widthValue);
    expect(repaired?.heightValue).toBe(original?.heightValue);
    expect(repaired?.backgroundColor).toBe(original?.backgroundColor);
    expect(repaired?.backgroundColor).toBe('#ff0000');
  });

  it('is deterministic — the same file repairs to the same ids', () => {
    const a = parseCode(DUP_TSX, DUP_CSS);
    const b = parseCode(DUP_TSX, DUP_CSS);
    expect(a.duplicateIdRepairs).toEqual(b.duplicateIdRepairs);
    expect(Object.keys(a.elements).sort()).toEqual(
      Object.keys(b.elements).sort()
    );
  });

  it('does not collide with a real id that appears later in the file', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_1a2b" className={styles.rect_1a2b}></div>
      <div data-scamp-id="rect_1a2b" className={styles.rect_1a2b}></div>
      <div data-scamp-id="rect_c3d4" className={styles.rect_c3d4}></div>
    </div>`;
    const { elements, duplicateIdRepairs } = parseCode(tsx, DUP_CSS);
    const newId = shortOf(duplicateIdRepairs![0]!.to);
    expect(newId).not.toBe('1a2b');
    expect(newId).not.toBe('c3d4');
    // All three ids distinct and present.
    expect(elements['1a2b']).toBeDefined();
    expect(elements['c3d4']).toBeDefined();
    expect(elements[newId]).toBeDefined();
  });

  it('reports nothing for a well-formed page', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_1a2b" className={styles.rect_1a2b}></div>
    </div>`;
    const { duplicateIdRepairs } = parseCode(tsx, DUP_CSS);
    expect(duplicateIdRepairs).toBeUndefined();
  });

  it('round-trips: after generate the repaired file has no more duplicates', () => {
    const first = parseCode(DUP_TSX, DUP_CSS);
    const regen = generateCode({
      elements: first.elements,
      rootId: first.rootId,
      pageName: 'home',
    });
    // The regenerated file emits two distinct classes...
    const second = parseCode(regen.tsx, regen.css);
    expect(second.duplicateIdRepairs).toBeUndefined();
    // ...and re-parses to the same element set.
    expect(Object.keys(second.elements).sort()).toEqual(
      Object.keys(first.elements).sort()
    );
  });
});
