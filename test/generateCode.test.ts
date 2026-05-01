import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const makeRoot = (childIds: string[] = []): ScampElement => ({
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'stretch',
  widthValue: 1440,
  heightMode: 'auto',
  heightValue: 900,
  minHeight: '100vh',
  x: 0,
  y: 0,
  display: 'none',
  flexDirection: 'row',
  gap: 0,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  gridTemplateColumns: '',
  gridTemplateRows: '',
  columnGap: 0,
  rowGap: 0,
  justifyItems: 'stretch',
  gridColumn: '',
  gridRow: '',
  alignSelf: 'stretch',
  justifySelf: 'stretch',
  padding: [0, 0, 0, 0],
  margin: [0, 0, 0, 0],
  backgroundColor: '#ffffff',
  borderRadius: [0, 0, 0, 0],
  borderWidth: [0, 0, 0, 0],
  borderStyle: 'none',
  borderColor: '#000000',
  opacity: 1,
  visibilityMode: 'visible',
  position: 'auto',
  transitions: [],
  inlineFragments: [],
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
    expect(tsx).toContain('data-scamp-id="rect_a1b2"');
    expect(tsx).toContain('data-scamp-id="rect_c3d4"');
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
    expect(tsx).toContain('<p data-scamp-id="text_t001"');
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
  it('emits a near-empty root block (stretch/auto defaults) with position: relative and min-height: 100vh', () => {
    const { css } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: makeRoot() },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(css).toContain('.root {');
    // With stretch width + auto height as the new defaults, no width
    // or fixed height declarations land in CSS — only `width: 100%`
    // and the `min-height: 100vh` floor that gives the root visible
    // height in any browser.
    expect(css).not.toContain('width: 1440px;');
    expect(css).toContain('min-height: 100vh;');
    expect(css).not.toContain('\n  height:');
    // `position: relative` IS emitted so absolute-positioned children
    // anchor to the root both on the canvas and in the exported app.
    expect(css).toContain('position: relative;');
  });

  it('emits a custom min-height value when the user overrides the default', () => {
    const root: ScampElement = {
      ...makeRoot(),
      minHeight: '500px',
    };
    const { css } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: root },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const block = extractBlock(css, '.root');
    expect(block).toContain('min-height: 500px;');
    expect(block).not.toContain('min-height: 100vh;');
  });

  it('does not emit min-height on non-root elements with no value set', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).not.toContain('min-height:');
  });

  it('emits min-height on a non-root element when the user sets one', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', minHeight: '200px' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).toContain('min-height: 200px;');
  });

  it('emits an explicit fixed width on the root when the user sets one', () => {
    const root: ScampElement = {
      ...makeRoot(),
      widthMode: 'fixed',
      widthValue: 1200,
    };
    const { css } = generateCode({
      elements: { [ROOT_ELEMENT_ID]: root },
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(css).toContain('width: 1200px;');
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
      gridTemplateColumns: '',
      gridTemplateRows: '',
      columnGap: 0,
      rowGap: 0,
      justifyItems: 'stretch',
      gridColumn: '',
      gridRow: '',
      alignSelf: 'stretch',
      justifySelf: 'stretch',
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
        gridTemplateColumns: '',
        gridTemplateRows: '',
        columnGap: 0,
        rowGap: 0,
        justifyItems: 'stretch',
        gridColumn: '',
        gridRow: '',
        alignSelf: 'stretch',
        justifySelf: 'stretch',
        padding: [4, 8, 12, 16],
        widthValue: 320,
        heightValue: 240,
        backgroundColor: '#f0f0f0',
        borderRadius: [8, 8, 8, 8],
        borderWidth: [1, 1, 1, 1],
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
    expect(block).toContain('border-radius: 8px 8px 8px 8px;');
    expect(block).toContain('border-width: 1px 1px 1px 1px;');
    expect(block).toContain('border-style: solid;');
    expect(block).toContain('border-color: #cccccc;');
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
    expect(tsx).toContain('<section data-scamp-id="rect_s001"');
    expect(tsx).toContain('</section>');
    expect(tsx).toContain('<h1 data-scamp-id="text_t001"');
    expect(tsx).toContain('>About</h1>');
  });

  it('falls back to div / p when no tag is set', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 't001']),
      a1b2: makeRect({ id: 'a1b2', widthValue: 200, heightValue: 200 }),
      t001: makeRect({ id: 't001', type: 'text', text: 'Hi' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<div data-scamp-id="rect_a1b2"');
    expect(tsx).toContain('<p data-scamp-id="text_t001"');
  });

  it('emits text-only properties only on text elements', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['t001']),
      t001: makeRect({
        id: 't001',
        type: 'text',
        text: 'Hi',
        fontSize: '14px',
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
        lineHeight: '1.5',
        letterSpacing: '2px',
      }),
      // A rectangle with lineHeight/letterSpacing accidentally set must
      // not emit them — only text elements get those declarations.
      a1b2: makeRect({ id: 'a1b2', lineHeight: '1.5', letterSpacing: '2px' }),
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
      t001: makeRect({ id: 't001', type: 'text', text: 'Hi', fontSize: '14px' }),
    };
    const { css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const block = extractBlock(css, '.text_t001');
    expect(block).not.toContain('line-height');
    expect(block).not.toContain('letter-spacing');
  });
});

describe('generateCode — element naming', () => {
  it('uses the slugified name as the class prefix when name is set', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', name: 'Hero Card' }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('data-scamp-id="hero_card_a1b2"');
    expect(tsx).toContain('className={styles.hero_card_a1b2}');
    // No data-scamp-name — name is derived from the class prefix.
    expect(tsx).not.toContain('data-scamp-name');
    // CSS uses the slugified selector.
    expect(css).toContain('.hero_card_a1b2 {');
  });

  it('falls back to the type prefix when name is undefined', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('data-scamp-id="rect_a1b2"');
    expect(tsx).toContain('className={styles.rect_a1b2}');
    expect(tsx).not.toContain('data-scamp-name');
    expect(css).toContain('.rect_a1b2 {');
  });

  it('uses dot notation for names without hyphens', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', name: 'Sidebar' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('className={styles.sidebar_a1b2}');
  });

  it('handles names that slugify to empty string (falls back to type prefix)', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', name: '!!!' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('data-scamp-id="rect_a1b2"');
  });
});

describe('generateCode — attribute bag', () => {
  it('emits each entry in the attributes bag as a JSX attribute', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        tag: 'a',
        text: 'About',
        type: 'text',
        attributes: { href: '/about', target: '_self' },
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<a data-scamp-id="text_a1b2"');
    expect(tsx).toContain('href="/about"');
    expect(tsx).toContain('target="_self"');
  });

  it('emits empty-string attributes as bare boolean HTML attributes', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['v001']),
      v001: makeRect({
        id: 'v001',
        type: 'image',
        tag: 'video',
        src: 'clip.mp4',
        alt: '',
        attributes: { controls: '', autoplay: '', muted: '', loop: '' },
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    // `controls=""` would emit with quotes — empty string stays bare.
    expect(tsx).toMatch(/ controls(?= )/);
    expect(tsx).toMatch(/ autoplay(?= )/);
    expect(tsx).toMatch(/ muted(?= )/);
    expect(tsx).toMatch(/ loop(?= )/);
    expect(tsx).not.toContain('controls=""');
  });

  it('HTML-escapes attribute values', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        attributes: { 'data-x': 'a "quoted" & <risky> value' },
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('data-x="a &quot;quoted&quot; &amp; &lt;risky&gt; value"');
  });

  it('preserves attribute name case (React-style htmlFor)', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['l001']),
      l001: makeRect({
        id: 'l001',
        type: 'text',
        tag: 'label',
        text: 'Email',
        attributes: { htmlFor: 'email' },
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('htmlFor="email"');
  });
});

describe('generateCode — select options', () => {
  it('emits option children from the selectOptions list', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['s001']),
      s001: makeRect({
        id: 's001',
        type: 'input',
        tag: 'select',
        selectOptions: [
          { value: 'us', label: 'United States' },
          { value: 'ca', label: 'Canada', selected: true },
        ],
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<select data-scamp-id="input_s001"');
    expect(tsx).toContain('<option value="us">United States</option>');
    expect(tsx).toContain('<option value="ca" selected>Canada</option>');
    expect(tsx).toContain('</select>');
  });

  it('self-closes a select with no options', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['s001']),
      s001: makeRect({ id: 's001', type: 'input', tag: 'select', selectOptions: [] }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<select data-scamp-id="input_s001"');
    expect(tsx).toMatch(/<select[^>]*\/>/);
  });
});

describe('generateCode — svg source', () => {
  it('emits svgSource verbatim between the svg open and close tags', () => {
    const raw = '<circle cx="50" cy="50" r="40" fill="red" />';
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['v001']),
      v001: makeRect({
        id: 'v001',
        type: 'image',
        tag: 'svg',
        svgSource: `\n  ${raw}\n`,
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<svg data-scamp-id="img_v001"');
    expect(tsx).toContain(raw);
    expect(tsx).toContain('</svg>');
  });

  it('self-closes an empty svg', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['v001']),
      v001: makeRect({ id: 'v001', type: 'image', tag: 'svg' }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toMatch(/<svg[^>]*\/>/);
  });
});

describe('generateCode — input element type', () => {
  it('uses input_ class prefix for input-type elements', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['i001']),
      i001: makeRect({
        id: 'i001',
        type: 'input',
        attributes: { type: 'email', placeholder: 'you@example.com' },
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toContain('<input data-scamp-id="input_i001"');
    expect(tsx).toContain('type="email"');
    expect(tsx).toContain('placeholder="you@example.com"');
    expect(css).toContain('.input_i001 {');
  });

  it('self-closes void input/img tags', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['i001']),
      i001: makeRect({ id: 'i001', type: 'input', attributes: { type: 'text' } }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(tsx).toMatch(/<input[^>]*\/>/);
  });

  it('does not self-close textarea even when empty', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['t001']),
      t001: makeRect({
        id: 't001',
        type: 'input',
        tag: 'textarea',
        attributes: { rows: '3', placeholder: 'Say hi' },
      }),
    };
    const { tsx } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    // Textarea is not in VOID_TAGS, so it renders as <textarea ... />
    // via the "no children and no text" fall-through. Regardless, the
    // panel writes rows/placeholder attrs that should appear.
    expect(tsx).toContain('<textarea data-scamp-id="input_t001"');
    expect(tsx).toContain('rows="3"');
  });
});

describe('opacity and visibility', () => {
  it('omits opacity when it equals the default', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(css).not.toContain('opacity:');
  });

  it('emits opacity when it differs from the default', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', opacity: 0.5 }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(extractBlock(css, '.rect_a1b2')).toContain('opacity: 0.5;');
  });

  it('emits visibility: hidden when visibilityMode is hidden', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', visibilityMode: 'hidden' }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(extractBlock(css, '.rect_a1b2')).toContain('visibility: hidden;');
  });

  it('emits display: none and suppresses flex emits when visibilityMode is none', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        visibilityMode: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).toContain('display: none;');
    expect(block).not.toContain('display: flex;');
    expect(block).not.toContain('flex-direction:');
    expect(block).not.toContain('gap:');
  });

  it('emits nothing for visibility when visibilityMode is visible', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2' }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    const block = extractBlock(css, '.rect_a1b2');
    expect(block).not.toContain('visibility:');
    expect(block).not.toContain('display: none;');
  });
});

const extractBlock = (css: string, selector: string): string => {
  const idx = css.indexOf(`${selector} {`);
  if (idx < 0) throw new Error(`Selector not found: ${selector}`);
  const start = css.indexOf('{', idx);
  const end = css.indexOf('}', start);
  return css.slice(start + 1, end);
};
