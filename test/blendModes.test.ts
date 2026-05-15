import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { DEFAULT_BREAKPOINTS } from '@shared/types';

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
  mixBlendMode: 'normal',
  backgroundBlendMode: 'normal',
  boxShadows: [],
  filters: [],
  backdropFilters: [],
  toggledOffGroups: [],
  transitions: [],
  inlineFragments: [],
  customProperties: {},
});

const makeRect = (id: string, overrides: Partial<ScampElement> = {}): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

const buildCss = (
  element: ScampElement,
  rootChildIds: string[] = [element.id]
): string => {
  const elements = {
    [ROOT_ELEMENT_ID]: makeRoot(rootChildIds),
    [element.id]: element,
  };
  const { css } = generateCode({
    elements,
    rootId: ROOT_ELEMENT_ID,
    pageName: 'home',
    breakpoints: DEFAULT_BREAKPOINTS,
    customMediaBlocks: [],
  });
  return css;
};

describe('blend mode: generator', () => {
  it('omits both declarations when both fields are normal', () => {
    const css = buildCss(makeRect('a1b2'));
    expect(css).not.toContain('mix-blend-mode');
    expect(css).not.toContain('background-blend-mode');
  });

  it('emits mix-blend-mode for a non-default value', () => {
    const css = buildCss(makeRect('a1b2', { mixBlendMode: 'multiply' }));
    expect(css).toContain('mix-blend-mode: multiply;');
  });

  it('emits background-blend-mode for a non-default value', () => {
    const css = buildCss(
      makeRect('a1b2', { backgroundBlendMode: 'overlay' })
    );
    expect(css).toContain('background-blend-mode: overlay;');
  });

  it('emits both when both are set', () => {
    const css = buildCss(
      makeRect('a1b2', {
        mixBlendMode: 'screen',
        backgroundBlendMode: 'multiply',
      })
    );
    expect(css).toContain('mix-blend-mode: screen;');
    expect(css).toContain('background-blend-mode: multiply;');
  });
});

describe('blend mode: parser', () => {
  it('routes mix-blend-mode keyword into the typed field', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { mix-blend-mode: multiply; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.mixBlendMode).toBe('multiply');
    expect(elements['a1b2']?.customProperties).toEqual({});
  });

  it('routes background-blend-mode keyword into the typed field', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { background-blend-mode: hard-light; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.backgroundBlendMode).toBe('hard-light');
  });

  it('preserves an unknown blend keyword in customProperties', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { mix-blend-mode: plus-darker; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.mixBlendMode).toBe('normal');
    expect(elements['a1b2']?.customProperties).toEqual({
      'mix-blend-mode': 'plus-darker',
    });
  });

  it('parses keywords case-insensitively', () => {
    const tsx = `<div data-scamp-id="root" className={styles.root}><div data-scamp-id="a1b2" className={styles.rect_a1b2} /></div>`;
    const css = `.rect_a1b2 { mix-blend-mode: Color-Burn; }`;
    const { elements } = parseCode(tsx, css);
    expect(elements['a1b2']?.mixBlendMode).toBe('color-burn');
  });
});

describe('blend mode: round-trip', () => {
  it('round-trips both fields through generate → parse', () => {
    const original = makeRect('a1b2', {
      mixBlendMode: 'multiply',
      backgroundBlendMode: 'overlay',
    });
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: original,
    };
    const { tsx, css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    const { elements: parsed } = parseCode(tsx, css);
    expect(parsed['a1b2']?.mixBlendMode).toBe('multiply');
    expect(parsed['a1b2']?.backgroundBlendMode).toBe('overlay');
  });

  it('round-trips a hover-state mix-blend-mode override', () => {
    const original = makeRect('a1b2', {
      mixBlendMode: 'normal',
      stateOverrides: {
        hover: { mixBlendMode: 'screen' },
      },
    });
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: original,
    };
    const { tsx, css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain('.rect_a1b2:hover');
    expect(css).toMatch(/:hover[^}]*mix-blend-mode:\s*screen;/);

    const { elements: parsed } = parseCode(tsx, css);
    expect(parsed['a1b2']?.stateOverrides?.hover?.mixBlendMode).toBe('screen');
  });

  it('emits mix-blend-mode: normal at hover scope to clear an inherited blend', () => {
    const original = makeRect('a1b2', {
      mixBlendMode: 'multiply',
      stateOverrides: {
        hover: { mixBlendMode: 'normal' },
      },
    });
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: original,
    };
    const { tsx, css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toMatch(/:hover[^}]*mix-blend-mode:\s*normal;/);

    const { elements: parsed } = parseCode(tsx, css);
    expect(parsed['a1b2']?.stateOverrides?.hover?.mixBlendMode).toBe('normal');
  });

  it('round-trips a tablet-breakpoint background-blend-mode', () => {
    const tabletId = DEFAULT_BREAKPOINTS.find((b) => b.id === 'tablet')?.id;
    if (!tabletId) throw new Error('expected default tablet breakpoint');
    const original = makeRect('a1b2', {
      backgroundBlendMode: 'normal',
      breakpointOverrides: {
        [tabletId]: { backgroundBlendMode: 'multiply' },
      },
    });
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: original,
    };
    const { tsx, css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toMatch(/@media[^}]+\{[\s\S]*background-blend-mode:\s*multiply;/);

    const { elements: parsed } = parseCode(tsx, css, {
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    expect(
      parsed['a1b2']?.breakpointOverrides?.[tabletId]?.backgroundBlendMode
    ).toBe('multiply');
  });
});
