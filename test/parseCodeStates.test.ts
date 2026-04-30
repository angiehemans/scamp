import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { ROOT_ELEMENT_ID } from '@lib/element';

const HOME_TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2} />
    </div>
  );
}
`;

describe('parseCode — recognised state pseudo-classes', () => {
  it('routes a :hover block into stateOverrides.hover', () => {
    const css = `.root {
}

.rect_a1b2 {
  background: #ffffff;
}

.rect_a1b2:hover {
  background: #f0f0f0;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el).toBeDefined();
    expect(el?.stateOverrides?.hover?.backgroundColor).toBe('#f0f0f0');
    // Base value untouched.
    expect(el?.backgroundColor).toBe('#ffffff');
  });

  it('routes :hover, :active, and :focus into separate state buckets', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:hover {
  background: #aaaaaa;
}

.rect_a1b2:active {
  background: #888888;
}

.rect_a1b2:focus {
  background: #cccccc;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.stateOverrides?.hover?.backgroundColor).toBe('#aaaaaa');
    expect(el?.stateOverrides?.active?.backgroundColor).toBe('#888888');
    expect(el?.stateOverrides?.focus?.backgroundColor).toBe('#cccccc');
  });

  it('does not populate stateOverrides when no pseudo-class blocks are present', () => {
    const css = `.root {
}

.rect_a1b2 {
  background: #ffffff;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.stateOverrides).toBeUndefined();
  });
});

describe('parseCode — unrecognised pseudo-class blocks', () => {
  it('preserves :focus-visible verbatim in customSelectorBlocks', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:focus-visible {
  outline: 2px solid #0080ff;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.stateOverrides).toBeUndefined();
    expect(el?.customSelectorBlocks?.length).toBe(1);
    expect(el?.customSelectorBlocks?.[0]?.selector).toBe(
      '.rect_a1b2:focus-visible'
    );
    expect(el?.customSelectorBlocks?.[0]?.body).toContain(
      'outline: 2px solid #0080ff'
    );
  });

  it('preserves compound selectors like .foo:hover .child as raw', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:hover .child {
  color: red;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    // Compound selector — should NOT populate stateOverrides.hover.
    expect(el?.stateOverrides?.hover).toBeUndefined();
    expect(el?.customSelectorBlocks?.[0]?.selector).toBe(
      '.rect_a1b2:hover .child'
    );
  });

  it('preserves :nth-child and other functional pseudo-classes as raw', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:nth-child(odd) {
  background: #f5f5f5;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.customSelectorBlocks?.[0]?.selector).toBe(
      '.rect_a1b2:nth-child(odd)'
    );
  });

  it('separates recognised states from raw blocks for the same element', () => {
    const css = `.root {
}

.rect_a1b2 {
}

.rect_a1b2:hover {
  background: #aaa;
}

.rect_a1b2:focus-visible {
  outline: 2px solid blue;
}
`;
    const parsed = parseCode(HOME_TSX, css);
    const el = parsed.elements['a1b2'];
    expect(el?.stateOverrides?.hover?.backgroundColor).toBe('#aaa');
    expect(el?.customSelectorBlocks?.length).toBe(1);
    expect(el?.customSelectorBlocks?.[0]?.selector).toBe(
      '.rect_a1b2:focus-visible'
    );
  });
});

describe('parseCode — round-trip invariant with state overrides', () => {
  it('round-trips a hover override cleanly through generate → parse', () => {
    // Build the canvas state via parse, regenerate, parse again,
    // assert the second parse equals the first.
    const css = `.root {
  position: relative;
}

.rect_a1b2 {
  position: absolute;
  left: 0px;
  top: 0px;
  background: #ffffff;
  border-radius: 8px 8px 8px 8px;
}

.rect_a1b2:hover {
  background: #f0f0f0;
}
`;
    const first = parseCode(HOME_TSX, css);
    const regenerated = generateCode({
      elements: first.elements,
      rootId: first.rootId,
      pageName: 'home',
      customMediaBlocks: first.customMediaBlocks,
    });
    const second = parseCode(regenerated.tsx, regenerated.css);
    expect(second.elements).toEqual(first.elements);
  });

  it('round-trips raw pseudo-class blocks text-stable through generate → parse', () => {
    const css = `.root {
  position: relative;
}

.rect_a1b2 {
  position: absolute;
  left: 0px;
  top: 0px;
}

.rect_a1b2:hover {
  background: #aaaaaa;
}

.rect_a1b2:focus-visible {
  outline: 2px solid #0080ff;
}
`;
    const first = parseCode(HOME_TSX, css);
    const regenerated = generateCode({
      elements: first.elements,
      rootId: first.rootId,
      pageName: 'home',
      customMediaBlocks: first.customMediaBlocks,
    });
    const second = parseCode(regenerated.tsx, regenerated.css);
    expect(second.elements).toEqual(first.elements);
    // The raw block survived two round-trips.
    expect(second.elements['a1b2']?.customSelectorBlocks?.[0]?.selector).toBe(
      '.rect_a1b2:focus-visible'
    );
  });
});
