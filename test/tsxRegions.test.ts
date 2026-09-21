import { describe, it, expect } from 'vitest';

import { applyEdits } from '@lib/textEdits';
import { findTsxRegions, tsxEdits, tsxRegionChanges } from '@lib/tsxRegions';

/**
 * The parts of a view file Scamp owns, and what survives a save.
 * see docs/plans/incremental-writes-plan.md, phase 3
 */

const GENERATED = `import styles from './Card.module.css';

type CardProps = {
  title?: string;
  className?: string;
};

export default function Card({ title = "Hi", className }: CardProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <h1 data-scamp-id="t_a1b1" className={styles.t_a1b1}>{title}</h1>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;
`;

/** The same component as someone else would leave it. */
const HAND_WRITTEN = `import styles from './Card.module.css';
import { clsx } from 'clsx';

// Why this component exists.
const TONE = 'quiet';

type CardProps = {
  title?: string;
  className?: string;
};

export default function Card({ title = "Hi", className }: CardProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <h1 data-scamp-id="t_a1b1" className={styles.t_a1b1}>{title}</h1>
    </div>
  );
}

export const _scamp = { contract: 2, events: [] } as const;

export const tone = TONE;
`;

const apply = (base: string, next: string): string => applyEdits(base, tsxEdits(base, next));

describe('findTsxRegions', () => {
  it('finds the styles import, the props type, the component, and the meta export', () => {
    expect(findTsxRegions(GENERATED).map((r) => [r.kind, r.key])).toEqual([
      ['stylesImport', ''],
      ['propsType', 'CardProps'],
      ['component', 'Card'],
      ['scampMeta', ''],
    ]);
  });

  it('finds component imports by the component they name', () => {
    const source = `import styles from './Home.module.css';\nimport LinkCard from '@/components/LinkCard/LinkCard';\n`;
    expect(findTsxRegions(source).map((r) => [r.kind, r.key])).toEqual([
      ['stylesImport', ''],
      ['componentImport', 'LinkCard'],
    ]);
  });

  it('covers a multi-line signature and stops at the function close', () => {
    const source = `export default function Lobby({\n  code = "K",\n  className,\n}: LobbyProps) {\n  return null;\n}\n\nconst after = 1;\n`;
    const [region] = findTsxRegions(source);
    expect(region?.kind).toBe('component');
    expect(region?.text.endsWith('}\n')).toBe(true);
    expect(region?.text).not.toContain('const after');
  });

  it('claims nothing in a file with none of the landmarks', () => {
    expect(findTsxRegions('const x = 1;\n')).toEqual([]);
  });
});

describe('tsxRegionChanges', () => {
  it('finds nothing between a file and itself', () => {
    expect(tsxRegionChanges(GENERATED, GENERATED)).toEqual([]);
    expect(tsxRegionChanges(HAND_WRITTEN, HAND_WRITTEN)).toEqual([]);
  });

  it('touches only the component when only the markup changed', () => {
    const next = GENERATED.replace('{title}</h1>', '{title}!</h1>');
    const changes = tsxRegionChanges(GENERATED, next);
    expect(changes).toHaveLength(1);
    expect(apply(GENERATED, next)).toBe(next);
  });

  it('inserts a component import after the styles import', () => {
    const next = GENERATED.replace(
      "import styles from './Card.module.css';\n",
      "import styles from './Card.module.css';\nimport LinkCard from '@/components/LinkCard/LinkCard';\n"
    );
    const out = apply(GENERATED, next);
    expect(out).toContain("import LinkCard from '@/components/LinkCard/LinkCard';");
    expect(out.indexOf('LinkCard')).toBeGreaterThan(out.indexOf('styles'));
  });

  it('removes the import of a component no longer used', () => {
    const withImport = GENERATED.replace(
      "import styles from './Card.module.css';\n",
      "import styles from './Card.module.css';\nimport LinkCard from '@/components/LinkCard/LinkCard';\n"
    );
    expect(apply(withImport, GENERATED)).not.toContain('LinkCard');
  });
});

describe('a file Scamp did not write', () => {
  it('keeps the extra import, the constant, the comment, and the extra export', () => {
    // The change: the same edit to the markup, applied to the hand-written file.
    const next = GENERATED.replace('{title}</h1>', '{title}!</h1>');
    const out = apply(HAND_WRITTEN, next);
    expect(out).toContain("import { clsx } from 'clsx';");
    expect(out).toContain('// Why this component exists.');
    expect(out).toContain("const TONE = 'quiet';");
    expect(out).toContain('export const tone = TONE;');
    // And the markup did change.
    expect(out).toContain('{title}!</h1>');
  });

  it('leaves it byte-identical when the owned regions already agree', () => {
    expect(apply(HAND_WRITTEN, GENERATED)).toBe(HAND_WRITTEN);
  });
});

describe('tsxEdits', () => {
  it('narrows a region-sized change to the lines that differ', () => {
    const next = GENERATED.replace('{title}</h1>', '{title}!</h1>');
    const edits = tsxEdits(GENERATED, next);
    expect(edits).toHaveLength(1);
    // One line of the component, not the whole function.
    const covered = GENERATED.slice(edits[0]?.start ?? 0, edits[0]?.end ?? 0);
    expect(covered.split('\n').filter((l) => l.length > 0)).toHaveLength(1);
    expect(covered).toContain('data-scamp-id="t_a1b1"');
  });

  it('produces edits that apply in order without overlapping', () => {
    const next = GENERATED.replace('title?: string;', 'title?: string;\n  subtitle?: string;').replace(
      '{title}</h1>',
      '{title}</h1>\n      <p data-scamp-id="s_b2c3" className={styles.s_b2c3}>{subtitle}</p>'
    );
    const edits = tsxEdits(GENERATED, next);
    expect(edits.length).toBeGreaterThan(1);
    expect(applyEdits(GENERATED, edits)).toBe(next);
  });

  it('is stable: applying its own output again changes nothing', () => {
    const next = GENERATED.replace('{title}</h1>', '{title}!</h1>');
    const once = apply(HAND_WRITTEN, next);
    expect(apply(once, next)).toBe(once);
  });
});
