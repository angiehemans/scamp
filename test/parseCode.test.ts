import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';

const TSX_BASIC = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="a1b2" className={styles.rect_a1b2}>
        <div data-scamp-id="c3d4" className={styles.rect_c3d4} />
      </div>
    </div>
  );
}
`;

const CSS_BASIC = `.root {
  width: 1440px;
  height: 900px;
  position: relative;
}

.rect_a1b2 {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  padding: 24px;
  width: 400px;
  height: 300px;
  background: #f0f0f0;
  border-radius: 8px;
  border: 1px solid #cccccc;
  position: absolute;
  left: 100px;
  top: 50px;
}

.rect_c3d4 {
  width: 100px;
  height: 100px;
  background: #3b82f6;
  position: absolute;
  left: 12px;
  top: 24px;
}
`;

describe('parseCode — structure', () => {
  it('returns a tree with the expected elements + parent/child links', () => {
    const { elements, rootId } = parseCode(TSX_BASIC, CSS_BASIC);
    expect(rootId).toBe(ROOT_ELEMENT_ID);
    expect(Object.keys(elements).sort()).toEqual(['a1b2', 'c3d4', 'root']);
    expect(elements['root']?.childIds).toEqual(['a1b2']);
    expect(elements['a1b2']?.parentId).toBe(ROOT_ELEMENT_ID);
    expect(elements['a1b2']?.childIds).toEqual(['c3d4']);
    expect(elements['c3d4']?.parentId).toBe('a1b2');
  });

  it('produces an empty root tree when TSX is empty', () => {
    const { elements, rootId } = parseCode('', '');
    expect(rootId).toBe(ROOT_ELEMENT_ID);
    expect(elements[ROOT_ELEMENT_ID]).toBeDefined();
    expect(elements[ROOT_ELEMENT_ID]?.childIds).toEqual([]);
  });
});

describe('parseCode — CSS overlay', () => {
  it('applies non-default values from the CSS file', () => {
    const { elements } = parseCode(TSX_BASIC, CSS_BASIC);
    const a = elements['a1b2'];
    expect(a).toBeDefined();
    expect(a?.display).toBe('flex');
    expect(a?.flexDirection).toBe('column');
    expect(a?.gap).toBe(16);
    expect(a?.alignItems).toBe('center');
    expect(a?.padding).toEqual([24, 24, 24, 24]);
    expect(a?.widthValue).toBe(400);
    expect(a?.heightValue).toBe(300);
    expect(a?.backgroundColor).toBe('#f0f0f0');
    expect(a?.borderRadius).toEqual([8, 8, 8, 8]);
    expect(a?.borderWidth).toEqual([1, 1, 1, 1]);
    expect(a?.borderStyle).toBe('solid');
    expect(a?.borderColor).toBe('#cccccc');
    expect(a?.x).toBe(100);
    expect(a?.y).toBe(50);
  });

  it('falls back to defaults for properties not present in the CSS', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { width: 50px; }`;
    const { elements } = parseCode(tsx, css);
    const a = elements['a1b2'];
    expect(a?.widthValue).toBe(50);
    expect(a?.heightValue).toBe(DEFAULT_RECT_STYLES.heightValue);
    expect(a?.display).toBe(DEFAULT_RECT_STYLES.display);
    expect(a?.gap).toBe(DEFAULT_RECT_STYLES.gap);
  });

  it('switches to stretch mode for width: 100%', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { width: 100%; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.widthMode).toBe('stretch');
  });

  it('captures unmapped properties in customProperties', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { box-shadow: 0 2px 8px rgba(0,0,0,0.1); transform: rotate(2deg); }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.customProperties).toEqual({
      'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
      transform: 'rotate(2deg)',
    });
  });

  it('parses border longhand individually', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { border-width: 3px; border-style: dashed; border-color: red; }`;
    const { elements } = parseCode(tsx, css);
    const a = elements['a1b2'];
    expect(a?.borderWidth).toEqual([3, 3, 3, 3]);
    expect(a?.borderStyle).toBe('dashed');
    expect(a?.borderColor).toBe('red');
  });

  it('parses padding shorthand', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { padding: 4px 8px 12px 16px; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.padding).toEqual([4, 8, 12, 16]);
  });
});

describe('parseCode — width/height inference', () => {
  it('marks width/height as auto when neither is declared', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { background: red; }`;
    const { elements } = parseCode(tsx, css);
    const a = elements['a1b2'];
    expect(a?.widthMode).toBe('auto');
    expect(a?.heightMode).toBe('auto');
  });

  it('keeps explicit width as fixed and infers auto height', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { width: 640px; }`;
    const { elements } = parseCode(tsx, css);
    const a = elements['a1b2'];
    expect(a?.widthMode).toBe('fixed');
    expect(a?.widthValue).toBe(640);
    expect(a?.heightMode).toBe('auto');
  });

  it('handles width: auto / height: auto explicitly written in the file', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { width: auto; height: auto; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.widthMode).toBe('auto');
    expect(elements['a1b2']?.heightMode).toBe('auto');
  });
});

describe('parseCode — semantic HTML tags', () => {
  it('captures an h1 tag for a text element', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <h1 data-scamp-id="t001" className={styles.text_t001}>About</h1>
    </div>`;
    const css = `.text_t001 { font-size: 56px; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['t001']?.type).toBe('text');
    expect(elements['t001']?.tag).toBe('h1');
    expect(elements['t001']?.text).toBe('About');
  });

  it('captures a section tag for a rectangle element', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <section data-scamp-id="a1b2" className={styles.rect_a1b2} />
    </div>`;
    const css = `.rect_a1b2 { width: 600px; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.type).toBe('rectangle');
    expect(elements['a1b2']?.tag).toBe('section');
  });

  it('does not store an explicit tag when it matches the type default', () => {
    // div for rect, p for text — these are the implicit defaults so the
    // round-trip stays text-stable when nobody picked a semantic tag.
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="a1b2" className={styles.rect_a1b2} />
      <p data-scamp-id="t001" className={styles.text_t001}>Hi</p>
    </div>`;
    const css = `.rect_a1b2 { width: 100px; height: 100px; } .text_t001 { font-size: 14px; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.tag).toBeUndefined();
    expect(elements['t001']?.tag).toBeUndefined();
  });

  it('treats h2 tag with text_ classname as text', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <h2 data-scamp-id="t002" className={styles.text_t002}>Subtitle</h2>
    </div>`;
    const css = `.text_t002 {}`;
    const { elements } = parseCode(tsx, css);
    expect(elements['t002']?.type).toBe('text');
    expect(elements['t002']?.tag).toBe('h2');
  });
});

describe('parseCode — text element detection', () => {
  it('classifies elements with the text_ className prefix as text, even when written as <div>', () => {
    // Hand-written / agent-written files often use <div> for text
    // elements. The PRD's contract is that the className prefix is the
    // source of truth.
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="t001" className={styles.text_t001}>Hello</div>
    </div>`;
    const css = `.text_t001 { font-size: 14px; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['t001']?.type).toBe('text');
    expect(elements['t001']?.text).toBe('Hello');
  });

  it('classifies <p> tags as text even with no className prefix match', () => {
    // Belt-and-braces: tag-name fallback still works for unrecognized
    // class formats.
    const tsx = `<div data-scamp-id="root" className={styles.root}>
      <p data-scamp-id="t001" className={styles.weird}>Hello</p>
    </div>`;
    const css = `.weird {}`;
    const { elements } = parseCode(tsx, css);
    expect(elements['t001']?.type).toBe('text');
  });
});

describe('parseCode — text elements', () => {
  const TSX_TEXT = `<div data-scamp-id="root" className={styles.root}>
    <p data-scamp-id="t001" className={styles.text_t001}>Hello world</p>
  </div>`;
  const CSS_TEXT = `.text_t001 { font-size: 14px; font-weight: 600; color: #222222; text-align: center; position: absolute; left: 0; top: 0; }`;

  it('detects text elements from <p> tags', () => {
    const { elements } = parseCode(TSX_TEXT, CSS_TEXT);
    expect(elements['t001']?.type).toBe('text');
    expect(elements['t001']?.text).toBe('Hello world');
  });

  it('parses text styling', () => {
    const { elements } = parseCode(TSX_TEXT, CSS_TEXT);
    const t = elements['t001'];
    expect(t?.fontSize).toBe(14);
    expect(t?.fontWeight).toBe(600);
    expect(t?.color).toBe('#222222');
    expect(t?.textAlign).toBe('center');
  });
});

describe('parseCode — root handling', () => {
  it('reads the root frame size from the .root rule', () => {
    const { elements } = parseCode(TSX_BASIC, CSS_BASIC);
    const root = elements[ROOT_ELEMENT_ID];
    expect(root?.widthValue).toBe(1440);
    expect(root?.heightValue).toBe(900);
  });

  it('does not store position fields for the root element', () => {
    const { elements } = parseCode(TSX_BASIC, CSS_BASIC);
    const root = elements[ROOT_ELEMENT_ID];
    expect(root?.x).toBe(0);
    expect(root?.y).toBe(0);
  });

  it('reads flex container properties on the root', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}></div>`;
    const css = `.root {
      width: 1440px;
      height: 900px;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      padding: 24px;
      background: #0f0f0f;
    }`;
    const { elements } = parseCode(tsx, css);
    const root = elements[ROOT_ELEMENT_ID];
    expect(root?.display).toBe('flex');
    expect(root?.flexDirection).toBe('column');
    expect(root?.gap).toBe(16);
    expect(root?.alignItems).toBe('center');
    expect(root?.justifyContent).toBe('space-between');
    expect(root?.padding).toEqual([24, 24, 24, 24]);
    expect(root?.backgroundColor).toBe('#0f0f0f');
  });

  it('captures unmapped properties on the root as customProperties', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}></div>`;
    const css = `.root {
      width: 1440px;
      height: 900px;
      position: relative;
      box-shadow: inset 0 0 0 1px #333;
    }`;
    const { elements } = parseCode(tsx, css);
    expect(elements[ROOT_ELEMENT_ID]?.customProperties).toEqual({
      'box-shadow': 'inset 0 0 0 1px #333',
    });
  });

  it('reads min-height on the root as the base page height', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}></div>`;
    const css = `.root {
      width: 1440px;
      min-height: 1200px;
      position: relative;
    }`;
    const { elements } = parseCode(tsx, css);
    const root = elements[ROOT_ELEMENT_ID];
    expect(root?.heightValue).toBe(1200);
    // Since `min-height` is rewritten to `height` for the mapper, no
    // residue should land in customProperties.
    expect(root?.customProperties).toEqual({});
  });
});
