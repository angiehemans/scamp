import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const makeRoot = (childIds: string[] = []): ScampElement => ({
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'fixed',
  widthValue: 1440,
  heightMode: 'fixed',
  heightValue: 900,
  x: 0,
  y: 0,
  display: 'none',
  flexDirection: 'row',
  gap: 0,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: [0, 0, 0, 0],
  margin: [0, 0, 0, 0],
  backgroundColor: '#ffffff',
  borderRadius: [0, 0, 0, 0],
  borderWidth: [0, 0, 0, 0],
  borderStyle: 'none',
  borderColor: '#000000',
  customProperties: {},
});

const makeRect = (overrides: Partial<ScampElement> & { id: string }): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

describe('sync round-trip integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-sync-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('round-trips a non-trivial element tree through the file system', async () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 't001']),
      a1b2: makeRect({
        id: 'a1b2',
        x: 100,
        y: 50,
        widthValue: 400,
        heightValue: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: [4, 8, 12, 16],
        backgroundColor: '#f0f0f0',
        borderRadius: [8, 8, 8, 8],
        borderWidth: [1, 1, 1, 1],
        borderStyle: 'solid',
        borderColor: '#cccccc',
        childIds: ['c3d4'],
        customProperties: {
          'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
        },
      }),
      c3d4: makeRect({
        id: 'c3d4',
        parentId: 'a1b2',
        // Parent (a1b2) has display: flex, so position/left/top are
        // stripped on round-trip and the stored x/y is always 0,0.
        x: 0,
        y: 0,
        widthValue: 100,
        // heightValue must differ from the default (100) so the
        // generator emits an explicit `height:` and the parser reads
        // back `heightMode: 'fixed'` rather than `auto`.
        heightValue: 80,
        widthMode: 'stretch',
        backgroundColor: '#3b82f6',
      }),
      t001: makeRect({
        id: 't001',
        type: 'text',
        x: 200,
        y: 400,
        // The default widthValue/heightValue (100) round-trip via the
        // generator as `auto` mode (no width/height declaration), so we
        // pick non-default sizes here to lock in `fixed` mode.
        widthValue: 240,
        heightValue: 32,
        text: 'Hello & welcome',
        fontSize: 14,
        fontWeight: 600,
        color: '#222222',
        textAlign: 'center',
      }),
    };

    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });

    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');

    const tsxRead = await fs.readFile(tsxPath, 'utf-8');
    const cssRead = await fs.readFile(cssPath, 'utf-8');

    const parsed = parseCode(tsxRead, cssRead);
    expect(parsed.rootId).toBe(ROOT_ELEMENT_ID);
    expect(parsed.elements).toEqual(elements);
  });

  it('round-trips a tree with semantic HTML tags', async () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['hdr1', 'sec1']),
      hdr1: makeRect({
        id: 'hdr1',
        type: 'text',
        tag: 'h1',
        text: 'About',
        widthValue: 400,
        heightValue: 60,
        fontSize: 56,
        fontWeight: 700,
        color: '#1a1a1a',
      }),
      sec1: makeRect({
        id: 'sec1',
        tag: 'section',
        widthValue: 600,
        heightValue: 400,
        backgroundColor: '#f5f5f5',
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<h1 data-scamp-id="text_hdr1"');
    expect(tsx).toContain('<section data-scamp-id="rect_sec1"');

    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');
    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements).toEqual(elements);
  });

  it('round-trips an empty page (root only)', async () => {
    const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');
    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements).toEqual(elements);
  });

  it('round-trips a flex root with positionless children', async () => {
    // When the root is a flex container, children should not carry x/y in
    // their stored state after a round-trip — generateCode skips
    // position/left/top, parseCode reads x=0,y=0 as defaults.
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: {
        ...makeRoot(['a1b2', 'c3d4']),
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
        padding: [24, 24, 24, 24],
      },
      a1b2: makeRect({
        id: 'a1b2',
        x: 0,
        y: 0,
        widthValue: 200,
        heightValue: 200,
        backgroundColor: '#3b82f6',
      }),
      c3d4: makeRect({
        id: 'c3d4',
        x: 0,
        y: 0,
        widthValue: 200,
        heightValue: 200,
        backgroundColor: '#10b981',
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    // No position emitted for children
    expect(css).not.toMatch(/\.rect_a1b2[^}]*position:/);
    expect(css).not.toMatch(/\.rect_c3d4[^}]*position:/);

    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');
    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements).toEqual(elements);
  });

  it('round-trips margin, line-height, and letter-spacing as typed fields', async () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 't001']),
      a1b2: makeRect({
        id: 'a1b2',
        widthValue: 320,
        heightValue: 200,
        margin: [12, 24, 12, 24],
        backgroundColor: '#f0f0f0',
      }),
      t001: makeRect({
        id: 't001',
        type: 'text',
        text: 'Hello',
        widthValue: 240,
        heightValue: 32,
        fontSize: 14,
        fontWeight: 600,
        color: '#222222',
        textAlign: 'center',
        lineHeight: 1.5,
        letterSpacing: 2,
        margin: [4, 0, 4, 0],
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    // Confirm the new declarations actually land in the file (i.e. they're
    // routed through the typed emitter, not the customProperties bag).
    expect(css).toContain('margin: 12px 24px 12px 24px;');
    expect(css).toContain('line-height: 1.5;');
    expect(css).toContain('letter-spacing: 2px;');

    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');

    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements).toEqual(elements);
    // And confirm the values are NOT hiding in customProperties — that was
    // the pre-Phase-1 behavior we're explicitly replacing.
    expect(parsed.elements.a1b2!.customProperties).toEqual({});
    expect(parsed.elements.t001!.customProperties).toEqual({});
  });

  it('round-trips named elements with custom class prefixes', async () => {
    // Names are stored as slugs — parseCode derives them from the class
    // prefix, so round-trip preserves the slug, not the original casing.
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 't001']),
      a1b2: makeRect({
        id: 'a1b2',
        name: 'hero_card',
        widthValue: 400,
        heightValue: 300,
        backgroundColor: '#f0f0f0',
      }),
      t001: makeRect({
        id: 't001',
        type: 'text',
        name: 'title',
        text: 'Hello',
        widthValue: 240,
        heightValue: 32,
        fontSize: 24,
        fontWeight: 700,
        color: '#111111',
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('data-scamp-id="hero_card_a1b2"');
    expect(tsx).not.toContain('data-scamp-name');
    expect(css).toContain('.hero_card_a1b2 {');
    expect(tsx).toContain('data-scamp-id="title_t001"');
    expect(css).toContain('.title_t001 {');

    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');

    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements).toEqual(elements);
    expect(parsed.elements.a1b2!.name).toBe('hero_card');
    expect(parsed.elements.t001!.name).toBe('title');
  });

  it('round-trips a root with custom flex layout and background', async () => {
    const root: ScampElement = {
      ...makeRoot(['a1b2']),
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: [16, 32, 16, 32],
      backgroundColor: '#0f0f0f',
    };
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: root,
      a1b2: makeRect({
        id: 'a1b2',
        // Flex children have no x/y in the file — flex layout owns their
        // placement, so the round-tripped state always reads back as 0,0.
        x: 0,
        y: 0,
        widthValue: 200,
        heightValue: 200,
        backgroundColor: '#3b82f6',
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const tsxPath = path.join(tmpDir, 'home.tsx');
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(tsxPath, tsx, 'utf-8');
    await fs.writeFile(cssPath, css, 'utf-8');
    const parsed = parseCode(
      await fs.readFile(tsxPath, 'utf-8'),
      await fs.readFile(cssPath, 'utf-8')
    );
    expect(parsed.elements).toEqual(elements);
  });
});
