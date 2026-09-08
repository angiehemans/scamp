import { describe, it, expect } from 'vitest';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement, type TransformDef } from '@lib/element';
import {
  formatTransformList,
  parseTransformFunction,
  parseTransformList,
} from '@lib/parsers';

const makeRoot = (childIds: string[] = []): ScampElement => ({
  ...DEFAULT_ROOT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  x: 0,
  y: 0,
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

const cssFor = (a1b2: Partial<ScampElement>): string =>
  generateCode({
    elements: { [ROOT_ELEMENT_ID]: makeRoot(['a1b2']), a1b2: makeRect('a1b2', a1b2) },
    rootId: ROOT_ELEMENT_ID,
    pageName: 'home',
  }).css;

const block = (css: string): string => css.match(/\.rect_a1b2 \{([^}]*)\}/s)?.[1] ?? '';

const TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="a1b2" className={styles.rect_a1b2} />
    </div>
  );
}
`;
const parseWith = (decls: string): ScampElement | undefined =>
  parseCode(TSX, `.root {\n  width: 100%;\n}\n\n.rect_a1b2 {\n${decls}}\n`).elements['a1b2'];

describe('parseTransformFunction', () => {
  it('parses the two-axis forms', () => {
    expect(parseTransformFunction('translate(10px, -50%)')).toEqual({ kind: 'translate', x: '10px', y: '-50%' });
    expect(parseTransformFunction('rotate(45deg)')).toEqual({ kind: 'rotate', angle: 45 });
    expect(parseTransformFunction('scale(1.2, 0.8)')).toEqual({ kind: 'scale', x: 1.2, y: 0.8 });
    expect(parseTransformFunction('skew(10deg, -5deg)')).toEqual({ kind: 'skew', x: 10, y: -5 });
  });

  it('fills the missing second argument the way CSS does', () => {
    expect(parseTransformFunction('translate(10px)')).toEqual({ kind: 'translate', x: '10px', y: '0px' });
    expect(parseTransformFunction('scale(2)')).toEqual({ kind: 'scale', x: 2, y: 2 });
    expect(parseTransformFunction('skew(10deg)')).toEqual({ kind: 'skew', x: 10, y: 0 });
  });

  it('normalises the axis-specific spellings onto two axes', () => {
    expect(parseTransformFunction('translateX(-50%)')).toEqual({ kind: 'translate', x: '-50%', y: '0px' });
    expect(parseTransformFunction('translateY(1rem)')).toEqual({ kind: 'translate', x: '0px', y: '1rem' });
    expect(parseTransformFunction('scaleX(1.5)')).toEqual({ kind: 'scale', x: 1.5, y: 1 });
    expect(parseTransformFunction('scaleY(0.5)')).toEqual({ kind: 'scale', x: 1, y: 0.5 });
    expect(parseTransformFunction('skewX(12deg)')).toEqual({ kind: 'skew', x: 12, y: 0 });
    expect(parseTransformFunction('skewY(-3deg)')).toEqual({ kind: 'skew', x: 0, y: -3 });
  });

  it('accepts a unitless zero and a token as a translate length', () => {
    expect(parseTransformFunction('translate(0, 0)')).toEqual({ kind: 'translate', x: '0px', y: '0px' });
    expect(parseTransformFunction('translateX(var(--nudge))')).toEqual({ kind: 'translate', x: 'var(--nudge)', y: '0px' });
    expect(parseTransformFunction('rotate(0)')).toEqual({ kind: 'rotate', angle: 0 });
  });

  it('is case-insensitive on the function name', () => {
    expect(parseTransformFunction('TranslateX(4px)')).toEqual({ kind: 'translate', x: '4px', y: '0px' });
  });

  it('refuses what it cannot represent, so the declaration stays verbatim', () => {
    for (const bad of [
      'matrix(1, 0, 0, 1, 0, 0)',
      'translate3d(1px, 2px, 3px)',
      'rotate3d(1, 1, 1, 45deg)',
      'perspective(500px)',
      'rotate(0.5turn)',
      'rotate(45)',
      'translate(10px, 20px, 30px)',
      'scale(1px)',
      'translate(calc(100% - 10px))',
      'skew()',
      'spin(45deg)',
      '',
    ]) {
      expect(parseTransformFunction(bad), bad).toBeNull();
    }
  });
});

describe('parseTransformList / formatTransformList', () => {
  it('reads none and empty as an empty list', () => {
    expect(parseTransformList('none')).toEqual([]);
    expect(parseTransformList('  ')).toEqual([]);
  });

  it('parses a space-separated list in order', () => {
    expect(parseTransformList('translate(-50%, -50%) rotate(45deg) scale(1.2)')).toEqual([
      { kind: 'translate', x: '-50%', y: '-50%' },
      { kind: 'rotate', angle: 45 },
      { kind: 'scale', x: 1.2, y: 1.2 },
    ]);
  });

  it('refuses the whole list when any function refuses', () => {
    expect(parseTransformList('rotate(45deg) matrix(1,0,0,1,0,0)')).toBeNull();
  });

  it('formats canonically: two-axis translate and skew, compact scale, deg angles', () => {
    expect(
      formatTransformList([
        { kind: 'translate', x: '10px', y: '0px' },
        { kind: 'rotate', angle: 45.5 },
        { kind: 'scale', x: 2, y: 2 },
        { kind: 'scale', x: 1.25, y: 1 },
        { kind: 'skew', x: 10, y: 0 },
      ])
    ).toBe('translate(10px, 0px) rotate(45.5deg) scale(2) scale(1.25, 1) skew(10deg, 0deg)');
  });

  it('round-trips format → parse for every kind', () => {
    const list: TransformDef[] = [
      { kind: 'translate', x: '-50%', y: '4px' },
      { kind: 'rotate', angle: -90 },
      { kind: 'scale', x: 0.5, y: 2 },
      { kind: 'skew', x: 0, y: 15 },
    ];
    expect(parseTransformList(formatTransformList(list))).toEqual(list);
  });
});

describe('transform: generator', () => {
  it('emits nothing for the defaults', () => {
    const b = block(cssFor({}));
    expect(b).not.toContain('transform');
  });

  it('emits transform and transform-origin', () => {
    const b = block(
      cssFor({
        transforms: [{ kind: 'rotate', angle: 45 }, { kind: 'scale', x: 1.2, y: 1.2 }],
        transformOrigin: 'top left',
      })
    );
    expect(b).toContain('transform: rotate(45deg) scale(1.2);');
    expect(b).toContain('transform-origin: top left;');
  });

  it('comments the group out when the transform group is toggled off', () => {
    const b = block(
      cssFor({
        transforms: [{ kind: 'rotate', angle: 45 }],
        transformOrigin: 'top left',
        toggledOffGroups: ['transform'],
      })
    );
    expect(b).toContain('/* transform: rotate(45deg); */');
    expect(b).toContain('/* transform-origin: top left; */');
    expect(b).not.toMatch(/^\s*transform:/m);
  });
});

describe('transform: parser', () => {
  it('routes a parseable transform into the typed fields', () => {
    const el = parseWith('  transform: translateX(-50%) rotate(10deg);\n  transform-origin: 0 0;\n');
    expect(el?.transforms).toEqual([
      { kind: 'translate', x: '-50%', y: '0px' },
      { kind: 'rotate', angle: 10 },
    ]);
    expect(el?.transformOrigin).toBe('0 0');
    expect(el?.customProperties).toEqual({});
  });

  it('keeps an unrepresentable transform verbatim in customProperties', () => {
    const el = parseWith('  transform: matrix(1, 0, 0, 1, 10, 20);\n');
    expect(el?.transforms).toEqual([]);
    expect(el?.customProperties).toEqual({ transform: 'matrix(1, 0, 0, 1, 10, 20)' });
  });

  it('reads transform: none as an empty list', () => {
    expect(parseWith('  transform: none;\n')?.transforms).toEqual([]);
  });
});

describe('transform: round trip', () => {
  it('generateCode → parseCode reproduces the element', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', {
        widthMode: 'auto',
        heightMode: 'auto',
        transforms: [
          { kind: 'translate', x: '-50%', y: '-50%' },
          { kind: 'rotate', angle: 30 },
          { kind: 'scale', x: 1.1, y: 0.9 },
          { kind: 'skew', x: 5, y: 0 },
        ],
        transformOrigin: 'bottom right',
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(parseCode(tsx, css).elements['a1b2']).toEqual(elements.a1b2);
  });

  it('round-trips a toggled-off transform group', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', {
        widthMode: 'auto',
        heightMode: 'auto',
        transforms: [{ kind: 'rotate', angle: 45 }],
        toggledOffGroups: ['transform'],
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    const parsed = parseCode(tsx, css).elements['a1b2'];
    expect(parsed?.transforms).toEqual([{ kind: 'rotate', angle: 45 }]);
    expect(parsed?.toggledOffGroups).toEqual(['transform']);
  });
});

describe('transform: state and breakpoint overrides', () => {
  it('emits and parses a hover-state transform', () => {
    const elements = {
      [ROOT_ELEMENT_ID]: makeRoot(['a1b2']),
      a1b2: makeRect('a1b2', {
        widthMode: 'auto',
        heightMode: 'auto',
        stateOverrides: { hover: { transforms: [{ kind: 'scale', x: 1.05, y: 1.05 }] } },
      }),
    };
    const { tsx, css } = generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
    expect(css).toMatch(/\.rect_a1b2:hover \{[^}]*transform: scale\(1\.05\);/s);
    expect(parseCode(tsx, css).elements['a1b2']?.stateOverrides?.hover).toEqual({
      transforms: [{ kind: 'scale', x: 1.05, y: 1.05 }],
    });
  });

  it('emits transform: none and the initial origin to clear inherited values at a state', () => {
    const css = cssFor({
      transforms: [{ kind: 'rotate', angle: 45 }],
      transformOrigin: 'top left',
      stateOverrides: { hover: { transforms: [], transformOrigin: '' } },
    });
    expect(css).toMatch(/\.rect_a1b2:hover \{[^}]*transform: none;/s);
    expect(css).toMatch(/\.rect_a1b2:hover \{[^}]*transform-origin: 50% 50%;/s);
  });
});
