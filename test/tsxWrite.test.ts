import { describe, it, expect } from 'vitest';

import { tsxWriteFor } from '@renderer/src/syncBridge/tsxWrite';

/**
 * What a save writes to the view file, and when it refuses to patch.
 * see docs/plans/incremental-writes-plan.md
 */

const PAGE = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root} />
  );
}
`;

const CSS = `.root {
    width: 100%;
}
`;

const write = (baseTsx: string | null): ReturnType<typeof tsxWriteFor> =>
  tsxWriteFor({ baseTsx, generatedTsx: PAGE, css: CSS, breakpoints: [], isComponent: false });

describe('tsxWriteFor', () => {
  it('writes the generated file when there is no base yet', () => {
    expect(write(null)).toEqual({ tsx: PAGE, patched: false });
  });

  it('leaves a file alone when only its formatting differs', () => {
    const formatted = PAGE.replace(
      '    <div data-scamp-id="root" className={styles.root} />',
      '    <div\n      data-scamp-id="root"\n      className={styles.root}\n    />'
    );
    expect(write(formatted)).toEqual({ tsx: formatted, patched: true });
  });

  it('writes the whole file rather than patching a page into a view wrapper', () => {
    // The file on disk is a different file: a one-line wrapper left by
    // converting the page to a view. Patching one into the other used
    // to append, leaving two default exports.
    const wrapper = `import Home from '@/views/Home/Home';

export default function HomePage() {
  return <Home />;
}
`;
    const result = write(wrapper);
    expect(result).toEqual({ tsx: PAGE, patched: false });
    expect(result.tsx.match(/export default function/g) ?? []).toHaveLength(1);
    expect(result.tsx).not.toContain('@/views/Home/Home');
  });

  it('writes the whole file when the base has no component at all', () => {
    expect(write('const x = 1;\n')).toEqual({ tsx: PAGE, patched: false });
  });
});
