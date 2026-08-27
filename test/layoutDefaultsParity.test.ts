import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';

/**
 * Two divergences the parity harness found, both of the same shape: a
 * model default or field routing that disagreed with CSS, so the file and
 * the canvas described different layouts.
 *
 * see docs/notes/align-items-default.md
 * see docs/notes/grid-gap-shorthand.md
 */

const pageWith = (css: string, display: string): { tsx: string; css: string } => ({
  tsx: `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="box_a1b2" className={styles.box_a1b2}>
        <div data-scamp-id="kid_c3d4" className={styles.kid_c3d4} />
      </div>
    </div>
  );
}
`,
  css: `.root { width: 100%; }
.box_a1b2 { width: 100%; display: ${display};${css} }
.kid_c3d4 { width: 40px; }
`,
});

const boxAfterRoundTrip = (source: { tsx: string; css: string }): string => {
  const parsed = parseCode(source.tsx, source.css);
  const out = generateCode({
    elements: parsed.elements,
    rootId: parsed.rootId,
    pageName: 'home',
    cssModuleImportName: 'home',
  });
  return out.css.match(/\.box_a1b2\s*\{[^}]*\}/s)?.[0] ?? '';
};

describe('align-items default matches CSS', () => {
  it('defaults to stretch, as CSS does', () => {
    // The canvas applies this value directly while the generator omits the
    // declaration at the default — so a `flex-start` default meant every
    // flex container that never set align-items rendered differently from
    // the browser.
    expect(DEFAULT_RECT_STYLES.alignItems).toBe('stretch');
    expect(DEFAULT_ROOT_STYLES.alignItems).toBe('stretch');
  });

  it('reads a file with no align-items as stretch', () => {
    const parsed = parseCode(...Object.values(pageWith('', 'flex')) as [string, string]);
    expect(parsed.elements['a1b2']?.alignItems).toBe('stretch');
  });

  it('does not write align-items back into a file that never had it', () => {
    expect(boxAfterRoundTrip(pageWith('', 'flex'))).not.toContain('align-items');
  });

  it('keeps an explicit align-items through a round trip', () => {
    const out = boxAfterRoundTrip(pageWith(' align-items: flex-start;', 'flex'));
    expect(out).toContain('align-items: flex-start;');
  });

  it('leaves justify-content alone, which already matched CSS', () => {
    expect(DEFAULT_RECT_STYLES.justifyContent).toBe('flex-start');
    expect(boxAfterRoundTrip(pageWith('', 'flex'))).not.toContain('justify-content');
  });
});

describe('gap shorthand on a grid', () => {
  it('populates both axes, as CSS `gap` does', () => {
    const parsed = parseCode(
      ...(Object.values(pageWith(' gap: 20px;', 'grid')) as [string, string])
    );
    const box = parsed.elements['a1b2'];
    expect(box?.columnGap).toBe(20);
    expect(box?.rowGap).toBe(20);
  });

  it('survives a save on a grid, rather than being deleted', () => {
    // The data-loss regression: a grid written with `gap` parsed to no gap
    // at all, and the generator then dropped the declaration entirely.
    expect(boxAfterRoundTrip(pageWith(' gap: 20px;', 'grid'))).toContain('gap: 20px;');
  });

  it('survives a save on a flex container too', () => {
    expect(boxAfterRoundTrip(pageWith(' gap: 20px;', 'flex'))).toContain('gap: 20px;');
  });

  it('writes the longhands when the axes differ', () => {
    const out = boxAfterRoundTrip(
      pageWith(' column-gap: 20px; row-gap: 8px;', 'grid')
    );
    expect(out).toContain('column-gap: 20px;');
    expect(out).toContain('row-gap: 8px;');
    expect(out).not.toMatch(/^\s*gap:/m);
  });

  it('emits nothing when there is no gap', () => {
    expect(boxAfterRoundTrip(pageWith('', 'grid'))).not.toContain('gap');
  });
});
