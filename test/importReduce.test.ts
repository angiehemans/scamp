import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

import { CAPTURE_VERSION, type CapturePayload, type CapturedNode } from '@shared/importCapture';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { reduceCapture, viewNameFromTitle } from '@lib/importReduce';
import { ROOT_ELEMENT_ID } from '@lib/element';

/**
 * The reducer: a captured page in, an element tree out.
 *
 * Two kinds of case here. Synthetic payloads pin one rule each, and the
 * real fixture — captured from a real browser by
 * `scripts/capture-import-fixtures.mjs` — proves the rules hold against
 * a layout engine's actual output, which is where every wrong
 * assumption has shown up so far.
 * see docs/plans/website-import-plan.md
 */

const node = (over: Partial<CapturedNode> = {}): CapturedNode => ({
  id: 0,
  tag: 'div',
  rect: { x: 0, y: 0, w: 1200, h: 400 },
  styles: {},
  text: null,
  attrs: {},
  children: [],
  notes: [],
  ...over,
});

const payloadOf = (root: CapturedNode, over: Partial<CapturePayload> = {}): CapturePayload => ({
  version: CAPTURE_VERSION,
  url: 'fixture:test',
  title: 'Test Page',
  viewport: { width: 1440, height: 900 },
  root,
  assets: [],
  notes: [],
  ...over,
});

/** Deterministic ids, as `element/tree.ts` does for its own tests. */
const seqIds = (): (() => string) => {
  let n = 0;
  return () => {
    n += 1;
    return n.toString(16).padStart(4, '0');
  };
};

const reduce = (root: CapturedNode, over: Partial<CapturePayload> = {}) =>
  reduceCapture(payloadOf(root, over), { randomId: seqIds() });

const kinds = (root: CapturedNode): string[] =>
  reduce(root).findings.map((f) => f.kind);

describe('reduceCapture — the shape it produces', () => {
  it('makes the captured root a div, whatever the page called it', () => {
    // The capture's root is `document.body`; a Scamp root is a div.
    const result = reduce(node({ tag: 'body' }));
    expect(result.elements['root']?.tag).toBeUndefined();
    expect(result.rootId).toBe('root');
  });

  it('classifies a tag into the model\'s four element types', () => {
    const result = reduce(
      node({
        children: [
          node({ tag: 'h1', text: 'Title' }),
          node({ tag: 'img', attrs: { src: 'https://x/a.png', alt: 'A' } }),
          node({ tag: 'input', attrs: { type: 'text' } }),
          node({ tag: 'section' }),
        ],
      })
    );
    const types = Object.values(result.elements)
      .filter((e) => e.id !== 'root')
      .map((e) => e.type);
    expect(types).toEqual(['text', 'image', 'input', 'rectangle']);
  });

  it('carries an image\'s src and alt into the typed fields', () => {
    const result = reduce(
      node({ children: [node({ tag: 'img', attrs: { src: 'https://x/a.png', alt: 'A cat' } })] })
    );
    const img = Object.values(result.elements).find((e) => e.type === 'image');
    expect(img?.src).toBe('https://x/a.png');
    expect(img?.alt).toBe('A cat');
    // …and not also in the attribute bag, which would emit them twice.
    expect(img?.attributes?.['src']).toBeUndefined();
  });

  it('names classes for what the element is, not what the DOM called it', () => {
    const result = reduce(node({ children: [node({ tag: 'nav' }), node({ tag: 'h1', text: 'x' })] }));
    const names = Object.values(result.elements)
      .filter((e) => e.id !== 'root')
      .map((e) => e.name);
    expect(names).toEqual(['nav', 'title']);
  });
});

describe('reduceCapture — a computed value is not a decision', () => {
  it('drops a width the element got for free, and stretches instead', () => {
    // Same width as its parent: it was filling, and `stretch` reproduces
    // that at any width.
    const child = node({
      tag: 'section',
      rect: { x: 0, y: 0, w: 1200, h: 100 },
      styles: { width: '1200px' },
      children: [node({ tag: 'p', text: 'x', rect: { x: 0, y: 0, w: 1200, h: 100 } })],
    });
    const result = reduce(node({ children: [child] }));
    const el = Object.values(result.elements).find((e) => e.tag === 'section');
    expect(el?.widthMode).toBe('stretch');
  });

  it('keeps a width the element chose, because that one is a decision', () => {
    // Narrower than the space it was given: not filling.
    const child = node({
      tag: 'section',
      rect: { x: 0, y: 0, w: 442, h: 100 },
      styles: { width: '442px' },
      children: [node({ tag: 'p', text: 'x', rect: { x: 0, y: 0, w: 442, h: 100 } })],
    });
    const result = reduce(node({ children: [child] }));
    const el = Object.values(result.elements).find((e) => e.tag === 'section');
    expect(el?.widthMode).toBe('fixed');
  });

  it('keeps every size when the capture carries no geometry', () => {
    // An older payload, or one captured without rects: guessing is worse
    // than being faithful, so nothing is dropped.
    const bare: CapturedNode = { ...node({ styles: { width: '442px' } }), rect: undefined };
    const result = reduceCapture(payloadOf({ ...bare, children: [node({ tag: 'p', text: 'x' })] }), {
      randomId: seqIds(),
    });
    expect(result.findings.some((f) => f.kind === 'dropped-computed-size')).toBe(false);
  });

  it('reports each size it dropped, so the report can explain the layout', () => {
    const child = node({
      tag: 'section',
      rect: { x: 0, y: 0, w: 1200, h: 100 },
      styles: { width: '1200px' },
      children: [node({ tag: 'p', text: 'x', rect: { x: 0, y: 0, w: 1200, h: 100 } })],
    });
    const found = reduce(node({ children: [child] })).findings.filter(
      (f) => f.kind === 'dropped-computed-size'
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.detail).toContain('1200px');
  });

  it('keeps a size on a leaf, where an explicit box is usually the point', () => {
    const result = reduce(node({ children: [node({ tag: 'img', styles: { width: '120px', height: '120px' } })] }));
    const img = Object.values(result.elements).find((e) => e.type === 'image');
    expect(img?.widthMode).not.toBe('auto');
    expect(kinds(node({ children: [node({ tag: 'img', styles: { width: '120px' } })] })))
      .not.toContain('dropped-computed-size');
  });
});

describe('reduceCapture — collapsing wrappers', () => {
  it('removes a div that holds one child and decides nothing', () => {
    const result = reduce(
      node({ children: [node({ tag: 'div', children: [node({ tag: 'nav', styles: { display: 'flex' } })] })] })
    );
    const tags = Object.values(result.elements).map((e) => e.tag);
    expect(tags).toContain('nav');
    expect(tags.filter((t) => t === 'div')).toHaveLength(0);
  });

  it('collapses a run of nested wrappers down to the thing inside', () => {
    const deep = node({
      children: [
        node({ children: [node({ children: [node({ tag: 'nav', styles: { display: 'flex' } })] })] }),
      ],
    });
    expect(reduce(deep).findings.filter((f) => f.kind === 'collapsed-wrapper')).toHaveLength(2);
  });

  it('keeps a wrapper that centres its child, which is real work', () => {
    const result = reduce(
      node({ children: [node({ styles: { display: 'flex' }, children: [node({ tag: 'p', text: 'x' })] })] })
    );
    expect(kinds(node({ children: [node({ styles: { display: 'flex' }, children: [node({ tag: 'p', text: 'x' })] })] })))
      .not.toContain('collapsed-wrapper');
    expect(Object.keys(result.elements)).toHaveLength(3);
  });

  it.each([
    ['a background', { 'background-color': 'rgb(1, 2, 3)' }],
    ['padding', { 'padding-top': '16px' }],
    ['a border', { 'border-top-width': '1px' }],
    ['a radius', { 'border-top-left-radius': '8px' }],
    ['a position', { position: 'sticky' }],
    ['a max-width', { 'max-width': '1200px' }],
  ])('keeps a wrapper that has %s', (_label, styles) => {
    const tree = node({ children: [node({ styles, children: [node({ tag: 'p', text: 'x' })] })] });
    expect(kinds(tree)).not.toContain('collapsed-wrapper');
  });

  it('never collapses a wrapper with two children, however plain', () => {
    const tree = node({
      children: [node({ children: [node({ tag: 'p', text: 'a' }), node({ tag: 'p', text: 'b' })] })],
    });
    expect(kinds(tree)).not.toContain('collapsed-wrapper');
  });

  it('keeps a non-div wrapper, because its tag is meaning', () => {
    const tree = node({ children: [node({ tag: 'main', children: [node({ tag: 'p', text: 'x' })] })] });
    expect(kinds(tree)).not.toContain('collapsed-wrapper');
  });
});

describe('reduceCapture — text', () => {
  it('keeps text on a text element that has no element children', () => {
    const result = reduce(node({ children: [node({ tag: 'p', text: 'Hello' })] }));
    const text = Object.values(result.elements).find((e) => e.type === 'text');
    expect(text?.text).toBe('Hello');
  });

  it('lifts text out of a container that also has element children', () => {
    // Scamp's rule: words live in a text element, never loose in a box.
    const result = reduce(
      node({ children: [node({ tag: 'div', text: 'Loose words', children: [node({ tag: 'p', text: 'Child' })] })] })
    );
    const texts = Object.values(result.elements).filter((e) => e.type === 'text');
    expect(texts.map((t) => t.text).sort()).toEqual(['Child', 'Loose words']);
    expect(kinds(node({ children: [node({ tag: 'div', text: 'Loose', children: [node({ tag: 'p', text: 'c' })] })] })))
      .toContain('wrapped-bare-text');
  });
});

describe('reduceCapture — inline content stays inline', () => {
  const para = (inline: NonNullable<CapturedNode['inline']>) =>
    node({
      children: [
        node({ tag: 'p', rect: { x: 0, y: 0, w: 400, h: 20 }, inline, text: null }),
      ],
    });

  it('keeps a leading text run as the element\'s own text', () => {
    const result = reduce(
      para([
        { kind: 'text', value: 'Ship ' },
        { kind: 'markup', source: '<strong>faster</strong>' },
      ])
    );
    const p = Object.values(result.elements).find((e) => e.type === 'text');
    expect(p?.text).toBe('Ship');
  });

  it('turns the markup into fragments rather than elements', () => {
    const result = reduce(
      para([
        { kind: 'text', value: 'Ship ' },
        { kind: 'markup', source: '<strong>faster</strong>' },
        { kind: 'text', value: ' today' },
      ])
    );
    // One paragraph, not a paragraph plus a box for the <strong>.
    expect(Object.keys(result.elements)).toHaveLength(2);
    const p = Object.values(result.elements).find((e) => e.type === 'text');
    expect(p?.inlineFragments).toEqual([
      { kind: 'jsx', source: '<strong>faster</strong>', afterChildIndex: -1 },
      { kind: 'text', value: ' today', afterChildIndex: -1 },
    ]);
  });

  it('handles a run that opens with markup, leaving text null', () => {
    const result = reduce(
      para([
        { kind: 'markup', source: '<em>New</em>' },
        { kind: 'text', value: ' in beta' },
      ])
    );
    const p = Object.values(result.elements).find((e) => e.type === 'text');
    expect(p?.text).toBeUndefined();
    expect(p?.inlineFragments).toHaveLength(2);
  });

  it('reports it, because the markup is no longer selectable on canvas', () => {
    expect(kinds(para([{ kind: 'markup', source: '<b>x</b>' }]))).toContain('inline-kept');
  });

  it('emits fragments as JSX that parses back to the same tree', () => {
    const elements = reduce(
      para([
        { kind: 'text', value: 'Read the ' },
        { kind: 'markup', source: '<a href="/docs">docs</a>' },
      ])
    ).elements;
    const out = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'M',
      cssModuleImportName: 'M',
      isComponent: true,
    });
    expect(out.tsx).toContain('<a href="/docs">docs</a>');
    const back = parseCode(out.tsx, out.css, { isComponent: true });
    expect(Object.keys(back.elements)).toHaveLength(Object.keys(elements).length);
  });
});

describe('reduceCapture — reporting', () => {
  it('carries every capture note through as a finding', () => {
    const tree = node({
      notes: [{ kind: 'pseudo-element', at: 'div::before', detail: '"★"' }],
      children: [node({ tag: 'canvas', notes: [{ kind: 'canvas', at: 'canvas' }] })],
    });
    expect(kinds(tree)).toEqual(expect.arrayContaining(['pseudo-element', 'canvas']));
  });

  it('reports a display the model has no equivalent for', () => {
    expect(kinds(node({ styles: { display: 'table' } }))).toContain('unsupported-display');
  });

  it('includes whole-page notes, like a cap being hit', () => {
    const result = reduceCapture(
      payloadOf(node({}), { notes: [{ kind: 'node-capped', detail: '4000' }] }),
      { randomId: seqIds() }
    );
    expect(result.findings.map((f) => f.kind)).toContain('node-capped');
  });
});

describe('reduceCapture — unhappy paths', () => {
  it('refuses a payload from a different contract version', () => {
    const stale = { ...payloadOf(node({})), version: 99 } as unknown as CapturePayload;
    expect(() => reduceCapture(stale)).toThrow(/version 99/);
  });

  it('reduces an empty page to a lone root', () => {
    const result = reduce(node({}));
    expect(Object.keys(result.elements)).toEqual(['root']);
  });

  it('survives a page that is one unsupported element', () => {
    const result = reduce(node({ children: [node({ tag: 'canvas', notes: [{ kind: 'canvas' }] })] }));
    expect(Object.keys(result.elements)).toHaveLength(2);
  });

  it('handles a deeply nested chain without losing the leaf', () => {
    let tree = node({ tag: 'p', text: 'bottom' });
    for (let i = 0; i < 40; i += 1) tree = node({ styles: { display: 'flex' }, children: [tree] });
    const result = reduce(node({ children: [tree] }));
    const texts = Object.values(result.elements).filter((e) => e.type === 'text');
    expect(texts[0]?.text).toBe('bottom');
  });

  it('gives every element a unique id', () => {
    const result = reduce(
      node({ children: Array.from({ length: 50 }, () => node({ tag: 'p', text: 'x' })) })
    );
    const ids = Object.values(result.elements).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('viewNameFromTitle', () => {
  it.each([
    ['Northwind — Ship faster', 'NorthwindShipFaster'],
    ['about us', 'AboutUs'],
    ['A Very Long Page Title That Goes On', 'AVeryLong'],
    ['', 'Imported'],
    ['   ', 'Imported'],
    ['!!!', 'Imported'],
    ['404', 'Imported404'],
  ])('turns %j into %j', (title, expected) => {
    expect(viewNameFromTitle(title)).toBe(expected);
  });
});

describe('against a page captured from a real browser', () => {
  const payload = JSON.parse(
    readFileSync('test/fixtures/import/payloads/marketing.json', 'utf-8')
  ) as CapturePayload;

  it('is the contract version this build reads', () => {
    // A stale fixture should fail here, loudly, not somewhere subtle.
    expect(payload.version).toBe(CAPTURE_VERSION);
  });

  it('lets a container that was filling keep filling', () => {
    // Not "never pins a width" — a width the page chose is a decision,
    // and dropping those measured 20 points worse. What must hold is
    // that the ones which were merely filling come back as stretch.
    const result = reduceCapture(payload, { randomId: seqIds() });
    const stretched = Object.values(result.elements).filter(
      (el) => el.childIds.length > 0 && el.widthMode === 'stretch'
    );
    expect(stretched.length).toBeGreaterThan(0);
  });

  it('produces a tree that generates and re-parses', () => {
    // The real contract: whatever comes out has to survive the pipeline
    // every other part of Scamp puts an element tree through.
    const result = reduceCapture(payload, { randomId: seqIds() });
    const { tsx, css } = generateCode({
      elements: result.elements,
      rootId: result.rootId,
      pageName: result.suggestedName,
      cssModuleImportName: result.suggestedName,
      isComponent: true,
    });
    const back = parseCode(tsx, css, { isComponent: true });
    expect(Object.keys(back.elements)).toHaveLength(Object.keys(result.elements).length);
    expect(tsx).not.toContain('<body');
    expect(tsx).toContain('data-scamp-id="root"');
  });

  it('finds the decorative pseudo-element the page relies on', () => {
    const result = reduceCapture(payload, { randomId: seqIds() });
    const pseudo = result.findings.filter((f) => f.kind === 'pseudo-element');
    expect(pseudo).toHaveLength(1);
    expect(pseudo[0]?.detail).toContain('★');
  });

  it('collapses the page\'s empty wrappers and keeps its real ones', () => {
    const result = reduceCapture(payload, { randomId: seqIds() });
    // `.nav-outer` / `.nav-mid` contribute nothing; `.nav` and `.hero` do.
    expect(result.findings.filter((f) => f.kind === 'collapsed-wrapper').length).toBeGreaterThan(0);
    const names = Object.values(result.elements).map((e) => e.name);
    expect(names).toContain('nav');
    expect(names).toContain('header');
    expect(names).toContain('card');
  });

  it('names the view after the page', () => {
    expect(reduceCapture(payload, { randomId: seqIds() }).suggestedName).toBe('NorthwindShipFaster');
  });
});
