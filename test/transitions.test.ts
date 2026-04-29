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

describe('transitions: generator', () => {
  it('omits the transition declaration when transitions is empty', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2'),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).not.toContain('transition');
  });

  it('emits a single transition shorthand for one entry', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', {
        transitions: [
          {
            property: 'opacity',
            durationMs: 200,
            easing: 'ease',
            delayMs: 0,
          },
        ],
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain('transition: opacity 200ms ease;');
  });

  it('joins multiple transitions with commas', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', {
        transitions: [
          { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
          {
            property: 'transform',
            durationMs: 300,
            easing: 'ease-in-out',
            delayMs: 100,
          },
        ],
      }),
    };
    const { css } = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    expect(css).toContain(
      'transition: opacity 200ms ease, transform 300ms ease-in-out 100ms;'
    );
  });
});

describe('transitions: parser', () => {
  it('reads the shorthand back into the transitions array', () => {
    const tsx = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
    </div>
  );
}
`;
    const css = `.root { width: 100%; }
.rect_a1b2 {
  transition: opacity 200ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1) 100ms;
}
`;
    const parsed = parseCode(tsx, css, { breakpoints: DEFAULT_BREAKPOINTS });
    const rect = parsed.elements['a1b2'];
    expect(rect?.transitions).toEqual([
      { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
      {
        property: 'transform',
        durationMs: 300,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        delayMs: 100,
      },
    ]);
  });
});

describe('transitions: round-trip', () => {
  it('round-trips through generateCode → parseCode', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', {
        transitions: [
          { property: 'opacity', durationMs: 200, easing: 'ease', delayMs: 0 },
          {
            property: 'transform',
            durationMs: 1000,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            delayMs: 50,
          },
        ],
      }),
    };
    const code = generateCode({
      elements,
      rootId: ROOT_ELEMENT_ID,
      pageName: 'home',
      breakpoints: DEFAULT_BREAKPOINTS,
      customMediaBlocks: [],
    });
    const parsed = parseCode(code.tsx, code.css, {
      breakpoints: DEFAULT_BREAKPOINTS,
    });
    expect(parsed.elements['a1b2']?.transitions).toEqual(
      elements['a1b2']?.transitions
    );
  });
});
