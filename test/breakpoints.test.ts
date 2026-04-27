import { describe, it, expect } from 'vitest';
import { generateCode, breakpointOverrideLines } from '@lib/generateCode';
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
  transitions: [],
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

describe('breakpointOverrideLines', () => {
  it('emits padding shorthand when padding is in the override', () => {
    const el = makeRect({ id: 'a1b2' });
    const lines = breakpointOverrideLines({ padding: [12, 12, 12, 12] }, el);
    expect(lines).toEqual(['padding: 12px 12px 12px 12px;']);
  });

  it('does NOT emit fields absent from the override, even if they equal defaults', () => {
    const el = makeRect({ id: 'a1b2' });
    const lines = breakpointOverrideLines({}, el);
    expect(lines).toEqual([]);
  });

  it('resolves width override against the element base when only mode is set', () => {
    const el = makeRect({ id: 'a1b2', widthMode: 'fixed', widthValue: 800 });
    const lines = breakpointOverrideLines({ widthMode: 'stretch' }, el);
    expect(lines).toEqual(['width: 100%;']);
  });

  it('emits width px value when override supplies both mode and value', () => {
    const el = makeRect({ id: 'a1b2', widthMode: 'fixed', widthValue: 800 });
    const lines = breakpointOverrideLines(
      { widthMode: 'fixed', widthValue: 360 },
      el
    );
    expect(lines).toEqual(['width: 360px;']);
  });

  it('translates visibilityMode: none into display: none', () => {
    const el = makeRect({ id: 'a1b2' });
    const lines = breakpointOverrideLines({ visibilityMode: 'none' }, el);
    expect(lines).toEqual(['display: none;']);
  });

  it('emits customProperties last, verbatim', () => {
    const el = makeRect({ id: 'a1b2' });
    const lines = breakpointOverrideLines(
      {
        padding: [8, 8, 8, 8],
        customProperties: { 'box-shadow': '0 2px 4px rgba(0,0,0,0.1)' },
      },
      el
    );
    expect(lines).toEqual([
      'padding: 8px 8px 8px 8px;',
      'box-shadow: 0 2px 4px rgba(0,0,0,0.1);',
    ]);
  });
});

describe('generateCode — @media blocks', () => {
  it('emits no @media blocks when no element has breakpoint overrides', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({ id: 'a1b2', padding: [16, 16, 16, 16] }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    expect(css).not.toContain('@media');
  });

  it('emits one @media block per breakpoint with overrides, widest first', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        padding: [24, 24, 24, 24],
        breakpointOverrides: {
          tablet: { padding: [12, 12, 12, 12] },
          mobile: { padding: [8, 8, 8, 8] },
        },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('@media (max-width: 390px)');
    // Tablet must come before mobile in source order so narrower wins
    // via CSS cascade.
    const tabletIdx = css.indexOf('(max-width: 768px)');
    const mobileIdx = css.indexOf('(max-width: 390px)');
    expect(tabletIdx).toBeGreaterThan(0);
    expect(mobileIdx).toBeGreaterThan(tabletIdx);
  });

  it('does not emit a breakpoint block when no element overrides it', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        breakpointOverrides: { mobile: { padding: [8, 8, 8, 8] } },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    expect(css).not.toContain('(max-width: 768px)');
    expect(css).toContain('(max-width: 390px)');
  });

  it('appends customMediaBlocks verbatim after known-breakpoint blocks', () => {
    const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
    const customBlock = `@media (prefers-color-scheme: dark) {
  .root {
    background: #000;
  }
}`;
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [customBlock],
    });
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('skips the desktop breakpoint in @media emission', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        // Desktop override is nonsense per our model — desktop is the
        // base. Generator skips it regardless.
        breakpointOverrides: { desktop: { padding: [4, 4, 4, 4] } },
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    expect(css).not.toContain('@media (max-width: 1440px)');
  });
});

describe('parseCode — @media routing', () => {
  const tsx = `<div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="a1b2" className={styles.rect_a1b2} />
    </div>`;

  it('routes known (max-width: Npx) declarations into breakpointOverrides', () => {
    const css = `.rect_a1b2 {
  padding: 24px 24px 24px 24px;
  width: 400px;
  height: 200px;
}

@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px 12px 12px 12px;
  }
}

@media (max-width: 390px) {
  .rect_a1b2 {
    padding: 8px 8px 8px 8px;
  }
}`;
    const { elements } = parseCode(tsx, css);
    const rect = elements['a1b2']!;
    expect(rect.breakpointOverrides).toBeDefined();
    expect(rect.breakpointOverrides?.tablet).toEqual({
      padding: [12, 12, 12, 12],
    });
    expect(rect.breakpointOverrides?.mobile).toEqual({
      padding: [8, 8, 8, 8],
    });
  });

  it('preserves unknown @media queries in customMediaBlocks', () => {
    const css = `.rect_a1b2 {}

@media (prefers-color-scheme: dark) {
  .rect_a1b2 {
    background: #000;
  }
}`;
    const parsed = parseCode(tsx, css);
    expect(parsed.customMediaBlocks.length).toBe(1);
    expect(parsed.customMediaBlocks[0]).toContain('prefers-color-scheme');
    // Unknown queries don't land in breakpointOverrides.
    expect(parsed.elements['a1b2']?.breakpointOverrides).toBeUndefined();
  });

  it('treats a max-width that does not match any known breakpoint as custom', () => {
    const css = `.rect_a1b2 {}

@media (max-width: 1024px) {
  .rect_a1b2 {
    padding: 16px;
  }
}`;
    const parsed = parseCode(tsx, css);
    expect(parsed.customMediaBlocks.length).toBe(1);
    expect(parsed.customMediaBlocks[0]).toContain('max-width: 1024px');
  });

  it('omits the breakpointOverrides field when no @media matches', () => {
    const css = `.rect_a1b2 { padding: 24px; }`;
    const parsed = parseCode(tsx, css);
    expect(parsed.elements['a1b2']?.breakpointOverrides).toBeUndefined();
  });
});

describe('breakpoints — round-trip', () => {
  it('round-trips tablet + mobile overrides on a single element', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        widthValue: 400,
        heightValue: 300,
        padding: [24, 24, 24, 24],
        breakpointOverrides: {
          tablet: { padding: [12, 12, 12, 12] },
          mobile: { padding: [8, 8, 8, 8], widthMode: 'stretch' },
        },
      }),
    };
    const { tsx, css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    const parsed = parseCode(tsx, css);
    expect(parsed.elements).toEqual(elements);
  });

  it('round-trips an unknown @media block verbatim', () => {
    const elements = { [ROOT_ELEMENT_ID]: makeRoot() };
    const customBlock = `@media (prefers-color-scheme: dark) {
    .root {
        background: #000;
    }
}`;
    const { tsx, css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [customBlock],
    });
    const parsed = parseCode(tsx, css);
    expect(parsed.customMediaBlocks.length).toBe(1);
    expect(parsed.customMediaBlocks[0]).toContain('prefers-color-scheme: dark');
  });
});
