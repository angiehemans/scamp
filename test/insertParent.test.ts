import { describe, it, expect } from 'vitest';
import { resolveInsertParent } from '../src/renderer/lib/insertParent';
import type { ScampElement } from '../src/renderer/lib/element';

// Minimal element factory — only the fields resolveInsertParent reads.
const el = (
  id: string,
  type: ScampElement['type'],
  parentId: string | null
): ScampElement =>
  ({ id, type, parentId } as unknown as ScampElement);

const ROOT = 'root';

const tree: Record<string, ScampElement> = {
  root: el('root', 'rectangle', null),
  card: el('card', 'rectangle', 'root'),
  photo: el('photo', 'image', 'card'),
  label: el('label', 'text', 'card'),
};

describe('resolveInsertParent', () => {
  it('returns the selected element when it is a container', () => {
    expect(resolveInsertParent(tree, 'card', ROOT)).toBe('card');
  });

  it('walks up to the container parent when the selection is a leaf', () => {
    expect(resolveInsertParent(tree, 'photo', ROOT)).toBe('card');
    expect(resolveInsertParent(tree, 'label', ROOT)).toBe('card');
  });

  it('falls back to root when nothing is selected', () => {
    expect(resolveInsertParent(tree, null, ROOT)).toBe(ROOT);
  });

  it('falls back to root when the selected id is unknown', () => {
    expect(resolveInsertParent(tree, 'ghost', ROOT)).toBe(ROOT);
  });

  it('returns root when the selection is the root itself', () => {
    expect(resolveInsertParent(tree, 'root', ROOT)).toBe('root');
  });

  it('does not loop on a malformed parent cycle', () => {
    const cyclic: Record<string, ScampElement> = {
      root: el('root', 'rectangle', null),
      a: el('a', 'image', 'b'),
      b: el('b', 'image', 'a'),
    };
    expect(resolveInsertParent(cyclic, 'a', ROOT)).toBe(ROOT);
  });
});
