import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { applyEdits } from '@lib/textEdits';
import { elementEdits, tsxSurgicalEdits } from '@lib/tsxElementEdits';
/**
 * see docs/plans/incremental-writes-plan.md, phase 5
 */
const CSS = `.root {
    position: relative;
}

.text_a1b1 {
    color: #111111;
}

.rect_b2c2 {
    width: 100px;
}
`;
/** The shape a generated save would write. */
const GENERATED = (text) => `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>${text}</h1>
      <div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />
    </div>
  );
}
`;
/** The same page as someone formatted it. */
const HAND_WRITTEN = `import styles from './home.module.css';
import { clsx } from 'clsx';

const TONE = 'quiet';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <h1
        data-scamp-id="text_a1b1"
        className={styles.text_a1b1}
      >
        Hello
      </h1>
      <div
        data-scamp-id="rect_b2c2"
        className={styles.rect_b2c2}
      />
    </div>
  );
}
`;
const side = (text) => {
    const parsed = parseCode(text, CSS, { breakpoints: [], isComponent: false });
    return { text, elements: parsed.elements, ranges: parsed.ranges ?? {} };
};
describe('elementEdits', () => {
    it('finds nothing between a file and itself', () => {
        expect(elementEdits(side(GENERATED('Hello')), side(GENERATED('Hello')))).toEqual([]);
    });
    it('finds nothing between a file and its own generated form', () => {
        // Every line of the component differs; not one element does.
        expect(elementEdits(side(HAND_WRITTEN), side(GENERATED('Hello')))).toEqual([]);
    });
    it('is one edit, covering only the text, when only the text changed', () => {
        const edits = elementEdits(side(GENERATED('Hello')), side(GENERATED('Goodbye')));
        expect(edits).toHaveLength(1);
        expect(GENERATED('Hello').slice(edits?.[0]?.start, edits?.[0]?.end)).toBe('Hello');
        expect(edits?.[0]?.replacement).toBe('Goodbye');
    });
    it('edits the opening tag when an attribute changed', () => {
        const next = GENERATED('Hello').replace('<div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />', '<div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} title="hi" />');
        const edits = elementEdits(side(GENERATED('Hello')), side(next));
        expect(edits).toHaveLength(1);
        expect(edits?.[0]?.replacement).toContain('title="hi"');
    });
    it('gives up when an element was added', () => {
        const next = GENERATED('Hello').replace('    </div>\n  );', '      <p data-scamp-id="text_c3d3" className={styles.text_c3d3}>New</p>\n    </div>\n  );');
        expect(elementEdits(side(GENERATED('Hello')), side(next))).toBeNull();
    });
    it('gives up when an element was removed', () => {
        const next = GENERATED('Hello').replace('      <div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />\n', '');
        expect(elementEdits(side(GENERATED('Hello')), side(next))).toBeNull();
    });
});
describe('a text change to a hand-formatted file', () => {
    it('touches the text and nothing else', () => {
        const edits = tsxSurgicalEdits(side(HAND_WRITTEN), side(GENERATED('Goodbye')));
        expect(edits).not.toBeNull();
        const out = applyEdits(HAND_WRITTEN, edits ?? []);
        // The new text landed.
        expect(out).toContain('Goodbye');
        // The multi-line opening tags survived, as did everything around them.
        expect(out).toContain('      <h1\n        data-scamp-id="text_a1b1"');
        expect(out).toContain('      <div\n        data-scamp-id="rect_b2c2"');
        expect(out).toContain("import { clsx } from 'clsx';");
        expect(out).toContain("const TONE = 'quiet';");
    });
    it('reads back as the design the save meant to write', () => {
        const edits = tsxSurgicalEdits(side(HAND_WRITTEN), side(GENERATED('Goodbye')));
        const out = applyEdits(HAND_WRITTEN, edits ?? []);
        const parsed = parseCode(out, CSS, { breakpoints: [], isComponent: false });
        const wanted = parseCode(GENERATED('Goodbye'), CSS, { breakpoints: [], isComponent: false });
        expect(parsed.elements).toEqual(wanted.elements);
    });
    it('is stable: the same save again writes nothing', () => {
        const edits = tsxSurgicalEdits(side(HAND_WRITTEN), side(GENERATED('Goodbye')));
        const out = applyEdits(HAND_WRITTEN, edits ?? []);
        expect(tsxSurgicalEdits(side(out), side(GENERATED('Goodbye')))).toEqual([]);
    });
    it('leaves a file alone when only its formatting differs', () => {
        const edits = tsxSurgicalEdits(side(HAND_WRITTEN), side(GENERATED('Hello')));
        expect(edits).toEqual([]);
        expect(applyEdits(HAND_WRITTEN, edits ?? [])).toBe(HAND_WRITTEN);
    });
});
describe('tsxSurgicalEdits', () => {
    it('leaves the caller to catch a change the elements cannot carry', () => {
        // Marking the text as a prop touches the element AND the function
        // signature, and only the element is in range. The edit is
        // offered, but the file it produces does not read back as the save
        // meant it — which is what `tsxWrite` verifies before writing.
        const next = GENERATED('Hello')
            .replace('export default function Home() {', 'export default function Home({ title = "Hello" }: HomeProps) {')
            .replace('>Hello</h1>', '>{title}</h1>');
        const edits = tsxSurgicalEdits(side(GENERATED('Hello')), side(next));
        expect(edits).not.toBeNull();
        const out = applyEdits(GENERATED('Hello'), edits ?? []);
        expect(out).not.toContain('title = "Hello"');
        const applied = parseCode(out, CSS, { breakpoints: [], isComponent: false });
        const wanted = parseCode(next, CSS, { breakpoints: [], isComponent: false });
        expect(applied.elements).not.toEqual(wanted.elements);
    });
    it('carries a change outside the component alongside the element edit', () => {
        const next = GENERATED('Goodbye').replace("import styles from './home.module.css';", "import styles from './home.module.css';\nimport LinkCard from '@/components/LinkCard/LinkCard';");
        const edits = tsxSurgicalEdits(side(HAND_WRITTEN), side(next));
        expect(edits).not.toBeNull();
        const out = applyEdits(HAND_WRITTEN, edits ?? []);
        expect(out).toContain('LinkCard');
        expect(out).toContain('Goodbye');
        expect(out).toContain('      <h1\n        data-scamp-id="text_a1b1"');
    });
});
