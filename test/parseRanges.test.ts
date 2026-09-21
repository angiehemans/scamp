import { describe, it, expect } from 'vitest';

import { parseCode } from '@lib/parseCode';

/**
 * Every element's range has to point at the file as written, not at the
 * rewritten text the tokenizer actually saw.
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

const parse = (tsx: string): ReturnType<typeof parseCode> =>
  parseCode(tsx, CSS, { breakpoints: [], isComponent: false });

const sliceOf = (tsx: string, id: string): string => {
  const range = parse(tsx).ranges?.[id];
  if (range === undefined) throw new Error(`no range for ${id}`);
  return tsx.slice(range.start, range.end);
};

const innerOf = (tsx: string, id: string): string => {
  const range = parse(tsx).ranges?.[id];
  if (range === undefined) throw new Error(`no range for ${id}`);
  return tsx.slice(range.openEnd, range.innerEnd);
};

describe('element ranges', () => {
  it('covers each element in a generated file', () => {
    const tsx = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>Hello</h1>
      <div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />
    </div>
  );
}
`;
    expect(sliceOf(tsx, 'a1b1')).toBe(
      '<h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>Hello</h1>'
    );
    expect(innerOf(tsx, 'a1b1')).toBe('Hello');
    expect(sliceOf(tsx, 'b2c2')).toBe(
      '<div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />'
    );
    expect(sliceOf(tsx, 'root').startsWith('<div data-scamp-id="root"')).toBe(true);
    expect(sliceOf(tsx, 'root').endsWith('</div>')).toBe(true);
  });

  it('covers a multi-line opening tag someone formatted by hand', () => {
    const tsx = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <h1
        data-scamp-id="text_a1b1"
        className={styles.text_a1b1}
      >
        Hello
      </h1>
    </div>
  );
}
`;
    const slice = sliceOf(tsx, 'a1b1');
    expect(slice.startsWith('<h1\n')).toBe(true);
    expect(slice.endsWith('</h1>')).toBe(true);
    expect(innerOf(tsx, 'a1b1').trim()).toBe('Hello');
  });

  it('points at the original text when an attribute was a braced expression', () => {
    // `href={url}` is rewritten before the tokenizer sees it, so an
    // unmapped offset would land in the wrong place.
    const tsx = `import styles from './home.module.css';

export default function Home({ url = "/x" }: HomeProps) {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <a data-scamp-id="text_a1b1" className={styles.text_a1b1} href={url}>Go</a>
      <div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />
    </div>
  );
}
`;
    expect(sliceOf(tsx, 'a1b1')).toBe(
      '<a data-scamp-id="text_a1b1" className={styles.text_a1b1} href={url}>Go</a>'
    );
    // The element after the rewritten one is where the offsets would drift.
    expect(sliceOf(tsx, 'b2c2')).toBe(
      '<div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />'
    );
  });

  it('points at the original text through a repeat wrapper', () => {
    const tsx = `import styles from './home.module.css';

export default function Home({ items = [{ id: "1" }] }: HomeProps) {
  return (
    <div data-scamp-id="root" className={styles.root}>
      {items.map((row) => (
        <div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} key={row.id} />
      ))}
    </div>
  );
}
`;
    expect(sliceOf(tsx, 'b2c2')).toBe(
      '<div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} key={row.id} />'
    );
  });

  it('points at the original text through a component root passthrough', () => {
    const tsx = `import styles from './Card.module.css';

export default function Card({ className }: CardProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>Hi</h1>
    </div>
  );
}
`;
    const ranges = parseCode(tsx, CSS, { breakpoints: [], isComponent: true }).ranges;
    const range = ranges?.['a1b1'];
    expect(range).toBeDefined();
    expect(tsx.slice(range?.start ?? 0, range?.end ?? 0)).toBe(
      '<h1 data-scamp-id="text_a1b1" className={styles.text_a1b1}>Hi</h1>'
    );
  });

  it('gives a self-closing element an empty inner range', () => {
    const tsx = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_b2c2" className={styles.rect_b2c2} />
    </div>
  );
}
`;
    const range = parse(tsx).ranges?.['b2c2'];
    expect(range?.openEnd).toBe(range?.innerEnd);
    expect(range?.openEnd).toBe(range?.end);
  });

  it('places every element of a file it has never seen before', () => {
    const tsx = `// hand written
import styles from './home.module.css';
import { clsx } from 'clsx';

const TONE = 'quiet';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      {/* a comment */}
      <h1 data-scamp-id="text_a1b1" className={clsx(styles.text_a1b1)}>Hello</h1>
    </div>
  );
}
`;
    const parsed = parse(tsx);
    for (const [id, range] of Object.entries(parsed.ranges ?? {})) {
      expect(tsx.slice(range.start, range.start + 1), `element ${id}`).toBe('<');
      expect(range.end).toBeGreaterThan(range.start);
    }
  });
});
