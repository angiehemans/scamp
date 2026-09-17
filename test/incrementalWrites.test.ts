import { describe, it, expect } from 'vitest';

import { generateCode } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { diffText, editStats } from '@lib/textEdits';

/**
 * How surgical a real design change is, measured through the generator.
 *
 * This is the premise of docs/plans/incremental-writes-plan.md: if one
 * design change already produces one small hunk, a save can write that
 * hunk instead of the file. The three cases below are the three change
 * classes the plan names — element-local, structural, and non-local —
 * and they are what phase 3 will have to keep minimal.
 */

const makeRoot = (childIds: string[]): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'stretch',
  heightMode: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  x: 0,
  y: 0,
  customProperties: {},
});

const makeEl = (overrides: Partial<ScampElement> & { id: string }): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

/** A page with enough shape that a one-element change has somewhere to hide. */
const page = (): Record<string, ScampElement> => ({
  [ROOT_ELEMENT_ID]: makeRoot(['header', 'card']),
  header: makeEl({
    id: 'header',
    childIds: ['title'],
    tag: 'header',
    display: 'flex',
    padding: [24, 24, 24, 24],
    backgroundColor: '#223344',
  }),
  title: makeEl({ id: 'title', parentId: 'header', type: 'text', text: 'Noise', tag: 'h1' }),
  card: makeEl({
    id: 'card',
    childIds: ['body'],
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: [16, 16, 16, 16],
    backgroundColor: '#ffffff',
    borderRadius: [8, 8, 8, 8],
  }),
  body: makeEl({ id: 'body', parentId: 'card', type: 'text', text: 'A party game.' }),
});

const build = (
  elements: Record<string, ScampElement>,
  isComponent = false
): { tsx: string; css: string } =>
  generateCode({
    elements,
    rootId: ROOT_ELEMENT_ID,
    pageName: isComponent ? 'Card' : 'home',
    ...(isComponent ? { cssModuleImportName: 'Card', isComponent: true } : {}),
  });

/** The change, as the edits a save would write for each file. */
const change = (
  before: Record<string, ScampElement>,
  after: Record<string, ScampElement>,
  isComponent = false
): { tsx: ReturnType<typeof editStats>; css: ReturnType<typeof editStats> } => {
  const a = build(before, isComponent);
  const b = build(after, isComponent);
  return {
    tsx: editStats(a.tsx, diffText(a.tsx, b.tsx)),
    css: editStats(a.css, diffText(a.css, b.css)),
  };
};

describe('an element-local change', () => {
  it('recolouring one element touches one CSS line and no TSX', () => {
    const before = page();
    const after = { ...before, card: { ...makeEl({ ...before['card'], id: 'card' }), backgroundColor: '#eeeeee' } };
    const stats = change(before, after);
    expect(stats.tsx.hunks).toBe(0);
    expect(stats.css.hunks).toBe(1);
    expect(stats.css.linesRemoved).toBe(1);
    expect(stats.css.linesAdded).toBe(1);
    // The rest of the file is untouched, which is the whole point.
    expect(stats.css.baseLines).toBeGreaterThan(10);
  });

  it('editing text touches one TSX line and no CSS', () => {
    const before = page();
    const after = { ...before, body: { ...makeEl({ ...before['body'], id: 'body' }), text: 'A party game for four.' } };
    const stats = change(before, after);
    expect(stats.css.hunks).toBe(0);
    expect(stats.tsx.hunks).toBe(1);
    expect(stats.tsx.linesRemoved).toBe(1);
    expect(stats.tsx.linesAdded).toBe(1);
  });
});

describe('a structural change', () => {
  it('adding an element inserts its markup and appends its rule', () => {
    const before = page();
    const after: Record<string, ScampElement> = {
      ...before,
      [ROOT_ELEMENT_ID]: makeRoot(['header', 'card', 'footer']),
      footer: makeEl({ id: 'footer', tag: 'footer', backgroundColor: '#111111' }),
    };
    const stats = change(before, after);
    // One insertion point in each file, and nothing removed from either.
    expect(stats.tsx.hunks).toBe(1);
    expect(stats.tsx.linesRemoved).toBe(0);
    expect(stats.css.hunks).toBe(1);
    expect(stats.css.linesRemoved).toBe(0);
  });

  it('deleting an element removes its markup and its rule, and nothing else', () => {
    const before = page();
    const after: Record<string, ScampElement> = {
      ...before,
      [ROOT_ELEMENT_ID]: makeRoot(['card']),
    };
    delete after['header'];
    delete after['title'];
    const stats = change(before, after);
    expect(stats.tsx.hunks).toBe(1);
    expect(stats.tsx.linesAdded).toBe(0);
    // The header's rule and its title's rule are adjacent in the file,
    // so their removal is one hunk.
    expect(stats.css.hunks).toBeLessThanOrEqual(2);
    expect(stats.css.linesAdded).toBe(0);
  });
});

describe('a non-local change', () => {
  it('marking a text as a prop touches the props type, the destructure, and the element', () => {
    const before = page();
    const after = { ...before, body: { ...makeEl({ ...before['body'], id: 'body' }), prop: 'blurb' } };
    const stats = change(before, after, true);
    // Three disjoint regions, which is the case a line-granular save has
    // to handle and the reason the plan doesn't promise "one hunk".
    expect(stats.tsx.hunks).toBeGreaterThan(1);
    expect(stats.tsx.hunks).toBeLessThanOrEqual(4);
    expect(stats.css.hunks).toBe(0);
  });
});

describe('the measurement itself', () => {
  it('reports no edits when nothing changed', () => {
    const elements = page();
    const stats = change(elements, { ...elements });
    expect(stats.tsx.hunks).toBe(0);
    expect(stats.css.hunks).toBe(0);
  });

  it('never rewrites more than a fraction of a file for a one-element change', () => {
    const before = page();
    const after = { ...before, card: { ...makeEl({ ...before['card'], id: 'card' }), gap: 24 } };
    const stats = change(before, after);
    const touched = stats.css.linesRemoved + stats.css.linesAdded;
    expect(touched).toBeLessThan(stats.css.baseLines / 4);
  });
});
