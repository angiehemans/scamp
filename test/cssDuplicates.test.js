import { describe, it, expect } from 'vitest';
import { findDuplicateDeclProps, parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
describe('findDuplicateDeclProps', () => {
    it('returns an empty list when no property repeats', () => {
        expect(findDuplicateDeclProps([
            { prop: 'width', value: '100px' },
            { prop: 'height', value: '50px' },
            { prop: 'background', value: 'red' },
        ])).toEqual([]);
    });
    it('returns the prop name when it repeats', () => {
        expect(findDuplicateDeclProps([
            { prop: 'height', value: '100%' },
            { prop: 'height', value: '100vh' },
        ])).toEqual(['height']);
    });
    it('returns multiple repeated prop names in first-appearance order', () => {
        expect(findDuplicateDeclProps([
            { prop: 'transform', value: 'rotate(2deg)' },
            { prop: 'color', value: 'red' },
            { prop: 'transform', value: 'scale(1.5)' },
            { prop: 'color', value: 'blue' },
        ])).toEqual(['transform', 'color']);
    });
    it('only reports a property once even if it appears 3+ times', () => {
        expect(findDuplicateDeclProps([
            { prop: 'background', value: 'red' },
            { prop: 'background', value: 'blue' },
            { prop: 'background', value: 'green' },
        ])).toEqual(['background']);
    });
    it('returns an empty list for an empty input', () => {
        expect(findDuplicateDeclProps([])).toEqual([]);
    });
});
describe('parseCode: cssDuplicates field', () => {
    const TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
    </div>
  );
}
`;
    it('reports the duplicate height property on the affected element', () => {
        const css = `.root {
}

.rect_a1b2 {
  height: 100%;
  height: 100vh;
}
`;
        const parsed = parseCode(TSX, css);
        expect(parsed.cssDuplicates['a1b2']).toEqual(['height']);
    });
    it('omits the entry entirely when no duplicates are present', () => {
        const css = `.root {
}

.rect_a1b2 {
  height: 100vh;
  width: 100%;
}
`;
        const parsed = parseCode(TSX, css);
        expect(parsed.cssDuplicates['a1b2']).toBeUndefined();
    });
    it('reports duplicates for multiple elements independently', () => {
        const TSX2 = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
      <div data-scamp-id="rect_c3d4" className={styles.rect_c3d4}></div>
    </div>
  );
}
`;
        const css = `.root {
}

.rect_a1b2 {
  height: 100%;
  height: 100vh;
}

.rect_c3d4 {
  background: red;
  background: blue;
}
`;
        const parsed = parseCode(TSX2, css);
        expect(parsed.cssDuplicates['a1b2']).toEqual(['height']);
        expect(parsed.cssDuplicates['c3d4']).toEqual(['background']);
    });
    it('detects duplicate unknown / customProperties declarations too', () => {
        const css = `.root {
}

.rect_a1b2 {
  transform: rotate(2deg);
  transform: scale(1.5);
}
`;
        const parsed = parseCode(TSX, css);
        expect(parsed.cssDuplicates['a1b2']).toEqual(['transform']);
    });
    it('returns an empty record when nothing in the file has duplicates', () => {
        const css = `.root {
  background: white;
}

.rect_a1b2 {
  height: 100vh;
}
`;
        const parsed = parseCode(TSX, css);
        expect(parsed.cssDuplicates).toEqual({});
    });
});
describe('generateCode: drops customProperties echo of a typed-emitted prop', () => {
    // The bug-shaped scenario: a file with `height: 100%; height: 100vh;`
    // parses into typed `heightMode: stretch` (from the first decl) plus
    // `customProperties.height: '100vh'` (the second decl, which the
    // mapper refused). Without the dedup-on-emit guard the generator
    // would re-emit BOTH lines, recreating the duplicate every save.
    // With the guard, the typed branch wins and the customProperties
    // echo is silently dropped.
    const TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}></div>
    </div>
  );
}
`;
    it('a duplicate height (100% then 100vh) re-emits as a single declaration', () => {
        const css = `.root {
}

.rect_a1b2 {
  height: 100%;
  height: 100vh;
}
`;
        const parsed = parseCode(TSX, css);
        // Pin the parser's intermediate state so a regression here is
        // legible without re-deriving everything from the CSS.
        expect(parsed.elements['a1b2']?.heightMode).toBe('stretch');
        expect(parsed.elements['a1b2']?.customProperties).toEqual({
            height: '100vh',
        });
        const out = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
        });
        // Exactly one `height:` declaration on `.rect_a1b2`. We don't
        // mandate which one wins — the parser's first-applied value (the
        // `100%` typed-stretch) is fine; the second (`100vh`) being
        // dropped on save is the user's "clean up duplicates" intent.
        // Word-boundary anchor on `height` so `min-height: 100vh` doesn't
        // accidentally count as a `height` declaration.
        const matches = out.css.match(/(?:^|\s)height:\s*[^;]+;/gm) ?? [];
        expect(matches).toHaveLength(1);
    });
    it('a single non-mappable height (no duplicate) still round-trips via customProperties', () => {
        const css = `.root {
}

.rect_a1b2 {
  height: var(--page-h);
}
`;
        const parsed = parseCode(TSX, css);
        const out = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
        });
        expect(out.css).toContain('height: var(--page-h);');
        // No accidental duplicate.
        const matches = out.css.match(/(?:^|\s)height:\s*[^;]+;/gm) ?? [];
        // 1 from .root's `min-height: 100vh` (matches because of the
        // initial `s` boundary lookbehind … wait, no: `\s` doesn't match
        // `-`, so `min-height` is NOT picked up). 1 from rect_a1b2's
        // `height: var(--page-h)`. Plus the rect's auto resolves to
        // nothing. Net: just the var() line.
        expect(matches.length).toBe(1);
    });
    it('customProperties unrelated to typed-emitted props are preserved verbatim', () => {
        const css = `.root {
}

.rect_a1b2 {
  background: red;
  transform: rotate(2deg);
}
`;
        const parsed = parseCode(TSX, css);
        const out = generateCode({
            elements: parsed.elements,
            rootId: parsed.rootId,
            pageName: 'home',
        });
        // background is typed; transform is in customProperties — both
        // should appear, neither duplicated.
        expect((out.css.match(/background:\s*[^;]+;/g) ?? []).length).toBe(1);
        expect((out.css.match(/transform:\s*[^;]+;/g) ?? []).length).toBe(1);
    });
});
