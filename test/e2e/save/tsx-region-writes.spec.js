import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved, readPageFiles } from '../fixtures/assertions';
/**
 * Phase 3 of docs/plans/incremental-writes-plan.md: a design change
 * rewrites the regions the generator owns in the view file and leaves
 * every other line alone. Before this, a single canvas edit dropped the
 * extra import, the module constant, the comment above the component,
 * and the second export.
 */
const HAND_WRITTEN_TSX = `// Written by hand. This comment must survive.
import styles from './home.module.css';
import { clsx } from 'clsx';

const TONE = 'quiet';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_seed" className={styles.rect_seed} />
    </div>
  );
}

export const tone = TONE;
export const classes = clsx;
`;
const HAND_WRITTEN_CSS = `.root {
    width: 100%;
    min-height: 100vh;
    position: relative;
}

.rect_seed {
    position: absolute;
    left: 40px;
    top: 40px;
    width: 120px;
    height: 80px;
    background: #cccccc;
}
`;
test.describe('a design change rewrites only the regions Scamp owns', () => {
    test.use({
        projectOptions: {
            pageContent: { home: { tsx: HAND_WRITTEN_TSX, css: HAND_WRITTEN_CSS } },
        },
    });
    test('keeps the extra import, the constant, the comment, and the extra exports', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Move the seeded box. Nothing about this touches the imports.
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 100, y: 80 }, { x: 260, y: 220 });
        await waitForSaved(window);
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        expect(tsx).toContain('// Written by hand. This comment must survive.');
        expect(tsx).toContain("import { clsx } from 'clsx';");
        expect(tsx).toContain("const TONE = 'quiet';");
        expect(tsx).toContain('export const tone = TONE;');
        expect(tsx).toContain('export const classes = clsx;');
        // And the move did land, in the stylesheet where it belongs.
        expect(css).not.toContain('left: 40px');
    });
    test('writes nothing when the markup did not change', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        // One real edit first, so the file is in its settled state. (Opening
        // a legacy project can write the stylesheet import twice; see
        // docs/plans/incremental-writes-plan.md.)
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 100, y: 80 }, { x: 200, y: 160 });
        await waitForSaved(window);
        const before = (await readPageFiles(project.dir, project.pageName)).tsx;
        expect(before).toContain("import { clsx } from 'clsx';");
        // Canvas activity with no model change writes nothing at all.
        await dragInFrame(window, { x: 100, y: 80 }, { x: 100, y: 80 });
        await window.waitForTimeout(1500);
        expect((await readPageFiles(project.dir, project.pageName)).tsx).toBe(before);
    });
});
