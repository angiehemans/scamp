import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';

/**
 * `position: absolute` on a child of a flex/grid container must survive a
 * parse. It used to be skipped unconditionally, leaving the typed field as
 * the `auto` sentinel — which for a flex child means "in flow", so the
 * generator emitted the class without `position` and the next save deleted
 * the declaration from the user's file.
 *
 * see docs/notes/parse-position-absolute-in-flex.md
 */

const page = (css: string): { tsx: string; css: string } => ({
  tsx: `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="box_a1b2" className={styles.box_a1b2}>
        <div data-scamp-id="glow_c3d4" className={styles.glow_c3d4} />
      </div>
    </div>
  );
}
`,
  css,
});

const parseGlow = (css: string) => {
  const src = page(css);
  const parsed = parseCode(src.tsx, src.css);
  return { parsed, glow: parsed.elements['c3d4'] };
};

const regenerate = (css: string): string => {
  const { parsed } = parseGlow(css);
  const out = generateCode({
    elements: parsed.elements,
    rootId: parsed.rootId,
    pageName: 'home',
    cssModuleImportName: 'page',
  });
  return out.css.match(/\.glow_c3d4\s*\{[^}]*\}/s)?.[0] ?? '';
};

const FLEX_PARENT = `.root { width: 100%; }
.box_a1b2 { display: flex; position: relative; }
.glow_c3d4 { width: 980px; height: 820px; position: absolute; left: 0px; top: 0px; }
`;

const GRID_PARENT = FLEX_PARENT.replace('display: flex', 'display: grid');

const PLAIN_PARENT = `.root { width: 100%; }
.box_a1b2 { position: relative; }
.glow_c3d4 { width: 980px; height: 820px; position: absolute; left: 0px; top: 0px; }
`;

describe('position: absolute inside a flex parent', () => {
  it('is kept on the element rather than collapsing to the auto sentinel', () => {
    expect(parseGlow(FLEX_PARENT).glow?.position).toBe('absolute');
  });

  it('survives a save, instead of being deleted from the file', () => {
    // The data-loss regression: fixing the CSS by hand worked until Scamp
    // next wrote the file, then reverted.
    expect(regenerate(FLEX_PARENT)).toContain('position: absolute;');
  });

  it('is kept inside a grid parent too', () => {
    expect(parseGlow(GRID_PARENT).glow?.position).toBe('absolute');
    expect(regenerate(GRID_PARENT)).toContain('position: absolute;');
  });

  it('is kept inside an inline-flex parent', () => {
    const css = FLEX_PARENT.replace('display: flex', 'display: inline-flex');
    expect(parseGlow(css).glow?.position).toBe('absolute');
  });
});

describe('position: absolute inside a non-layout parent', () => {
  it('stays the auto sentinel, since that is what Scamp would emit anyway', () => {
    // Not a regression to fix — keeping `auto` here leaves the element
    // adaptive and the round-trip text-stable.
    expect(parseGlow(PLAIN_PARENT).glow?.position).toBe('auto');
  });

  it('still emits position: absolute, so the file is unchanged', () => {
    expect(regenerate(PLAIN_PARENT)).toContain('position: absolute;');
  });
});

describe('other position values in a flex parent', () => {
  const withPosition = (value: string): string =>
    FLEX_PARENT.replace('position: absolute', `position: ${value}`);

  it('keeps fixed', () => {
    expect(parseGlow(withPosition('fixed')).glow?.position).toBe('fixed');
  });

  it('keeps sticky', () => {
    expect(parseGlow(withPosition('sticky')).glow?.position).toBe('sticky');
  });

  it('keeps relative on a non-root element', () => {
    expect(parseGlow(withPosition('relative')).glow?.position).toBe('relative');
  });
});

describe('round-trip stability', () => {
  it('a flex child with absolute positioning round-trips unchanged', () => {
    const first = regenerate(FLEX_PARENT);
    // Feed the regenerated CSS back in; the second pass must match the first.
    const src = page(FLEX_PARENT);
    const parsed = parseCode(src.tsx, src.css);
    const out = generateCode({
      elements: parsed.elements,
      rootId: parsed.rootId,
      pageName: 'home',
      cssModuleImportName: 'page',
    });
    const reparsed = parseCode(out.tsx, out.css);
    const second = generateCode({
      elements: reparsed.elements,
      rootId: reparsed.rootId,
      pageName: 'home',
      cssModuleImportName: 'page',
    });
    expect(second.css.match(/\.glow_c3d4\s*\{[^}]*\}/s)?.[0]).toBe(first);
  });
});
