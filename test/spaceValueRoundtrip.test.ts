import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import {
  parsePaddingShorthandOrNull,
  parseSpaceValueOrNull,
  parseVarTokenOrNull,
} from '@lib/parsers';
import { tokenSpaceValue } from '@lib/spaceValue';

const makeRoot = (childIds: string[] = []): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  widthMode: 'stretch',
  heightMode: 'auto',
  minHeight: '100vh',
  x: 0,
  y: 0,
  customProperties: {},
});

const makeRect = (
  overrides: Partial<ScampElement> & { id: string }
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

describe('parsers — var() token support', () => {
  describe('parseVarTokenOrNull', () => {
    it('parses a bare var() reference', () => {
      expect(parseVarTokenOrNull('var(--space-md)')).toBe('var(--space-md)');
    });

    it('parses var() with a fallback verbatim', () => {
      expect(parseVarTokenOrNull('var(--space-md, 16px)')).toBe(
        'var(--space-md, 16px)'
      );
    });

    it('rejects non-var values', () => {
      expect(parseVarTokenOrNull('16px')).toBeNull();
      expect(parseVarTokenOrNull('calc(16px + 8px)')).toBeNull();
      expect(parseVarTokenOrNull('1rem')).toBeNull();
      expect(parseVarTokenOrNull('')).toBeNull();
    });

    it('rejects malformed var() syntax', () => {
      expect(parseVarTokenOrNull('var(space-md)')).toBeNull(); // missing --
      expect(parseVarTokenOrNull('var(--)')).toBeNull(); // empty name
    });
  });

  describe('parseSpaceValueOrNull', () => {
    it('returns a number for px values', () => {
      expect(parseSpaceValueOrNull('16px')).toBe(16);
      expect(parseSpaceValueOrNull('0')).toBe(0);
    });

    it('returns a token form for var() refs', () => {
      expect(parseSpaceValueOrNull('var(--space-md)')).toEqual({
        kind: 'token',
        ref: 'var(--space-md)',
      });
    });

    it('rejects rem / % / auto', () => {
      expect(parseSpaceValueOrNull('1rem')).toBeNull();
      expect(parseSpaceValueOrNull('50%')).toBeNull();
      expect(parseSpaceValueOrNull('auto')).toBeNull();
    });
  });

  describe('parsePaddingShorthandOrNull with tokens', () => {
    it('parses 1 token-only value into a uniform tuple', () => {
      expect(parsePaddingShorthandOrNull('var(--space-md)')).toEqual([
        tokenSpaceValue('var(--space-md)'),
        tokenSpaceValue('var(--space-md)'),
        tokenSpaceValue('var(--space-md)'),
        tokenSpaceValue('var(--space-md)'),
      ]);
    });

    it('parses 2-value form mixing px and token', () => {
      const result = parsePaddingShorthandOrNull('16px var(--space-md)');
      expect(result).toEqual([
        16,
        tokenSpaceValue('var(--space-md)'),
        16,
        tokenSpaceValue('var(--space-md)'),
      ]);
    });

    it('parses 4-value form mixing tokens and pixels', () => {
      const result = parsePaddingShorthandOrNull(
        'var(--space-sm) 16px var(--space-md) 24px'
      );
      expect(result).toEqual([
        tokenSpaceValue('var(--space-sm)'),
        16,
        tokenSpaceValue('var(--space-md)'),
        24,
      ]);
    });

    it('rejects mixed unsupported units alongside tokens', () => {
      expect(parsePaddingShorthandOrNull('var(--space-md) 1rem')).toBeNull();
    });

    it('handles fallback-form tokens without splitting their internal comma', () => {
      const result = parsePaddingShorthandOrNull('var(--space-md, 16px) 8px');
      expect(result).toEqual([
        tokenSpaceValue('var(--space-md, 16px)'),
        8,
        tokenSpaceValue('var(--space-md, 16px)'),
        8,
      ]);
    });
  });
});

describe('parseCode → generateCode round-trip for spacing tokens', () => {
  it('var() in padding shorthand round-trips through the typed shape', () => {
    const cssIn = `
.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}
.rect_a1b2 {
  padding: var(--space-md);
}
`;
    const tsxIn = `
import styles from './home.module.css';
export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
    </div>
  );
}
`;
    const parsed = parseCode(tsxIn, cssIn);
    const el = parsed.elements['a1b2']!;
    expect(el.padding).toEqual([
      tokenSpaceValue('var(--space-md)'),
      tokenSpaceValue('var(--space-md)'),
      tokenSpaceValue('var(--space-md)'),
      tokenSpaceValue('var(--space-md)'),
    ]);
    // customProperties should NOT contain padding now — the typed
    // shape owns the value.
    expect(el.customProperties).not.toHaveProperty('padding');

    // Round-trip: regenerate and the var() emits back verbatim.
    const regen = generateCode({
      elements: parsed.elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(regen.css).toContain('padding: var(--space-md);');
  });

  it('mixed px+var in padding round-trips with the original ordering', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        padding: [
          tokenSpaceValue('var(--space-sm)'),
          16,
          tokenSpaceValue('var(--space-md)'),
          24,
        ],
      }),
    };
    const first = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(first.css).toContain(
      'padding: var(--space-sm) 16px var(--space-md) 24px;'
    );
    const parsed = parseCode(first.tsx, first.css);
    expect(parsed.elements['a1b2']!.padding).toEqual(elements.a1b2!.padding);
    const second = generateCode({
      elements: parsed.elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(second.css).toBe(first.css);
  });

  it('var() in gap, column-gap, row-gap round-trip', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        display: 'flex',
        gap: tokenSpaceValue('var(--space-md)'),
      }),
    };
    const first = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(first.css).toContain('gap: var(--space-md);');
    const parsed = parseCode(first.tsx, first.css);
    expect(parsed.elements['a1b2']!.gap).toEqual(
      tokenSpaceValue('var(--space-md)')
    );
  });

  it('var() in border-radius round-trips', () => {
    const elements: Record<string, ScampElement> = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect({
        id: 'a1b2',
        borderRadius: [
          tokenSpaceValue('var(--radius-md)'),
          tokenSpaceValue('var(--radius-md)'),
          tokenSpaceValue('var(--radius-md)'),
          tokenSpaceValue('var(--radius-md)'),
        ],
      }),
    };
    const first = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
    });
    expect(first.css).toContain('border-radius: var(--radius-md);');
    const parsed = parseCode(first.tsx, first.css);
    expect(parsed.elements['a1b2']!.borderRadius).toEqual([
      tokenSpaceValue('var(--radius-md)'),
      tokenSpaceValue('var(--radius-md)'),
      tokenSpaceValue('var(--radius-md)'),
      tokenSpaceValue('var(--radius-md)'),
    ]);
  });

  it('non-var non-px units still fall through to customProperties', () => {
    const cssIn = `
.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}
.rect_a1b2 {
  padding: 1rem;
}
`;
    const tsxIn = `
import styles from './home.module.css';
export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
    </div>
  );
}
`;
    const parsed = parseCode(tsxIn, cssIn);
    const el = parsed.elements['a1b2']!;
    expect(el.padding).toEqual([0, 0, 0, 0]);
    expect(el.customProperties['padding']).toBe('1rem');
  });
});
