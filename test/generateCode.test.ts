import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
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
  borderRadius: 0,
  borderWidth: 0,
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

describe('generateCode — TSX', () => {
  it('emits a default-export component named after the page', () => {
    const { tsx } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: makeRoot() },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(tsx).toContain(`import styles from './home.module.css';`);
    expect(tsx).toContain('export default function Home()');
    expect(tsx).toContain('data-scamp-id="root"');
    expect(tsx).toContain('className={styles.root}');
  });

  it('PascalCases hyphenated page names', () => {
    const { tsx } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: makeRoot() },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'checkout-flow',
    });
    expect(tsx).toContain('export default function CheckoutFlow()');
  });

  it('renders nested rectangles depth-first', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', childIds: ['c3d4'] }),
      c3d4: makeRect({ id: 'c3d4', parentId: 'a1b2' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('data-scamp-id="a1b2"');
    expect(tsx).toContain('data-scamp-id="c3d4"');
    expect(tsx.indexOf('a1b2')).toBeLessThan(tsx.indexOf('c3d4'));
  });

  it('self-closes rectangles with no children', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('className={styles.rect_a1b2} />');
  });

  it('emits text elements as <p> tags with HTML-escaped content', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['t001']),
      t001: makeRect({
        id: 't001',
        type: 'text',
        text: 'Hello & <world>',
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<p data-scamp-id="t001"');
    expect(tsx).toContain('className={styles.text_t001}');
    expect(tsx).toContain('Hello &amp; &lt;world&gt;');
    expect(tsx).not.toContain('<world>');
  });

  it('returns null body when the root element is missing', () => {
    const { tsx } = generateCode({
      elements: {},
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(tsx).toContain('return null;');
  });
});

describe('generateCode — flex parent', () => {
  it('omits position/left/top from immediate children of a flex root', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: {
        ...makeRoot(['a1b2']),
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
      },
      a1b2: makeRect({ id: 'a1b2', x: 100, y: 50, widthValue: 200, heightValue: 200 }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).not.toContain('position:');
    expect(block).not.toContain('left:');
    expect(block).not.toContain('top:');
    // Sizing is still emitted
    expect(block).toContain('width: 200px;');
    expect(block).toContain('height: 200px;');
  });

  it('keeps position absolute for nested children of a non-flex rect inside a flex root', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: { ...makeRoot(['a1b2']), display: 'flex' },
      a1b2: makeRect({
        id: 'a1b2',
        x: 0,
        y: 0,
        widthValue: 400,
        heightValue: 400,
        childIds: ['c3d4'],
      }),
      c3d4: makeRect({
        id: 'c3d4',
        parentId: 'a1b2',
        x: 20,
        y: 30,
        widthValue: 100,
        heightValue: 100,
      }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    // a1b2 is a flex item — no position
    const aBlock = extractBlock(css, '.rect_a1b2');
    expect(aBlock).not.toContain('position:');
    // c3d4's parent (a1b2) is NOT flex, so c3d4 keeps absolute positioning
    const cBlock = extractBlock(css, '.rect_c3d4');
    expect(cBlock).toContain('position: absolute;');
    expect(cBlock).toContain('left: 20px;');
    expect(cBlock).toContain('top: 30px;');
  });
});

describe('generateCode — CSS', () => {
  it('always emits root width / min-height / position', () => {
    const { css } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: makeRoot() },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(css).toContain('.root {');
    expect(css).toContain('width: 1440px;');
    // The page root uses `min-height` so the page can grow vertically
    // when its content exceeds the base canvas size.
    expect(css).toContain('min-height: 900px;');
    // ...and never a fixed `height:` declaration. The `\n  ` prefix
    // ensures we don't accidentally match the `height` substring inside
    // `min-height:`.
    expect(css).not.toContain('\n  height:');
    expect(css).toContain('position: relative;');
  });

  it('emits non-default flex container properties on the root', () => {
    const root: ScampElement = {
      ...makeRoot(),
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: [16, 16, 16, 16],
      backgroundColor: '#0f0f0f',
    };
    const { css } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: root },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const block = extractBlock(css, '.root');
    expect(block).toContain('display: flex;');
    expect(block).toContain('flex-direction: column;');
    expect(block).toContain('gap: 24px;');
    expect(block).toContain('align-items: center;');
    expect(block).toContain('justify-content: space-between;');
    expect(block).toContain('padding: 16px 16px 16px 16px;');
    expect(block).toContain('background: #0f0f0f;');
  });

  it('does not emit display/flex on the root when defaults are kept', () => {
    const { css } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: makeRoot() },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const block = extractBlock(css, '.root');
    expect(block).not.toContain('display:');
    expect(block).not.toContain('flex-direction:');
    expect(block).not.toContain('gap:');
  });

  it('omits properties equal to DEFAULT_RECT_STYLES', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    // Defaults: display none, gap 0, padding 0 — should not appear in the
    // .rect_a1b2 block. The block should still exist with position info.
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).not.toContain('display:');
    expect(block).not.toContain('gap:');
    expect(block).not.toContain('padding:');
    expect(block).not.toContain('background:');
    expect(block).toContain('position: absolute;');
  });

  it('emits non-default properties when set', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: [4, 8, 12, 16],
        widthValue: 320,
        heightValue: 240,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#cccccc',
      }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).toContain('display: flex;');
    expect(block).toContain('flex-direction: column;');
    expect(block).toContain('gap: 16px;');
    expect(block).toContain('align-items: center;');
    expect(block).toContain('justify-content: space-between;');
    expect(block).toContain('padding: 4px 8px 12px 16px;');
    expect(block).toContain('width: 320px;');
    expect(block).toContain('height: 240px;');
    expect(block).toContain('background: #f0f0f0;');
    expect(block).toContain('border-radius: 8px;');
    expect(block).toContain('border: 1px solid #cccccc;');
  });

  it('emits width: 100% for stretch mode', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', widthMode: 'stretch' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(extractBlock(css, '.rect_a1b2')).toContain('width: 100%;');
  });

  it('emits width: fit-content and height: fit-content', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', widthMode: 'fit-content', heightMode: 'fit-content' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).toContain('width: fit-content;');
    expect(block).toContain('height: fit-content;');
    // No fixed-pixel width should sneak in alongside fit-content.
    expect(block).not.toMatch(/width: \d+px/);
    expect(block).not.toMatch(/height: \d+px/);
  });

  it('appends customProperties verbatim and last', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        customProperties: {
          'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
          transform: 'rotate(2deg)',
        },
      }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).toContain('box-shadow: 0 2px 8px rgba(0,0,0,0.1);');
    expect(block).toContain('transform: rotate(2deg);');
    // customProperties must be last in the block
    const lines = block.trim().split('\n').map((l) => l.trim());
    expect(lines.at(-1)).toBe('transform: rotate(2deg);');
  });

  it('emits the element tag override (h1, section, etc) when present', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['s001', 't001']),
      // section has a child so it gets a real closing tag.
      s001: makeRect({
        id: 's001',
        tag: 'section',
        widthValue: 600,
        heightValue: 200,
        childIds: ['inner'],
      }),
      inner: makeRect({ id: 'inner', parentId: 's001' }),
      t001: makeRect({
        id: 't001',
        type: 'text',
        tag: 'h1',
        text: 'About',
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<section data-scamp-id="s001"');
    expect(tsx).toContain('</section>');
    expect(tsx).toContain('<h1 data-scamp-id="t001"');
    expect(tsx).toContain('>About</h1>');
  });

  it('falls back to div / p when no tag is set', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 't001']),
      a1b2: makeRect({ id: 'a1b2', widthValue: 200, heightValue: 200 }),
      t001: makeRect({ id: 't001', type: 'text', text: 'Hi' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<div data-scamp-id="a1b2"');
    expect(tsx).toContain('<p data-scamp-id="t001"');
  });

  it('emits text-only properties only on text elements', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['t001']),
      t001: makeRect({
        id: 't001',
        type: 'text',
        text: 'Hi',
        fontSize: 14,
        fontWeight: 600,
        color: '#222222',
        textAlign: 'center',
      }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.text_t001');
    expect(block).toContain('font-size: 14px;');
    expect(block).toContain('font-weight: 600;');
    expect(block).toContain('color: #222222;');
    expect(block).toContain('text-align: center;');
  });

  it('emits margin shorthand only when any side is non-zero', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'c3d4']),
      a1b2: makeRect({ id: 'a1b2', margin: [8, 16, 8, 16] }),
      c3d4: makeRect({ id: 'c3d4' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(extractBlock(css, '.rect_a1b2')).toContain('margin: 8px 16px 8px 16px;');
    expect(extractBlock(css, '.rect_c3d4')).not.toContain('margin:');
  });

  it('does not emit margin on the root element', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: { ...makeRoot(), margin: [16, 16, 16, 16] },
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(extractBlock(css, '.root')).not.toContain('margin:');
  });

  it('emits line-height and letter-spacing only on text elements when set', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['t001', 'a1b2']),
      t001: makeRect({
        id: 't001',
        type: 'text',
        text: 'Hi',
        lineHeight: 1.5,
        letterSpacing: 2,
      }),
      // A rectangle with lineHeight/letterSpacing accidentally set must
      // not emit them — only text elements get those declarations.
      a1b2: makeRect({ id: 'a1b2', lineHeight: 1.5, letterSpacing: 2 }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const textBlock = extractBlock(css, '.text_t001');
    expect(textBlock).toContain('line-height: 1.5;');
    expect(textBlock).toContain('letter-spacing: 2px;');
    const rectBlock = extractBlock(css, '.rect_a1b2');
    expect(rectBlock).not.toContain('line-height');
    expect(rectBlock).not.toContain('letter-spacing');
  });

  it('omits line-height and letter-spacing when undefined on a text element', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['t001']),
      t001: makeRect({ id: 't001', type: 'text', text: 'Hi', fontSize: 14 }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.text_t001');
    expect(block).not.toContain('line-height');
    expect(block).not.toContain('letter-spacing');
  });
});

const extractBlock = (css: string, selector: string): string => {
  const idx = css.indexOf(`${selector} {`);
  if (idx < 0) throw new Error(`Selector not found: ${selector}`);
  const start = css.indexOf('{', idx);
  const end = css.indexOf('}', start);
  return css.slice(start + 1, end);
};
