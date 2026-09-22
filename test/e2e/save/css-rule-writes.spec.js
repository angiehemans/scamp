import { test, expect } from '../fixtures/app';
import { defaultTestFormat } from '../fixtures/project';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved, readPageFiles } from '../fixtures/assertions';
/**
 * Phase 2 of docs/plans/incremental-writes-plan.md: a design change
 * rewrites the rules it changed and leaves the rest of the stylesheet
 * alone, including a file Scamp did not write.
 *
 * The root rule's full-height floor is seeded per format. A PAGE root
 * has `min-height: 100vh` and Scamp writes it back if it is missing; a
 * VIEW root drops the floor (docs/notes/component-min-height-floor.md)
 * and a save normalises it away. Either way the save is a no-op only if
 * the seed matches the target's baseline — so the seed has to ask.
 */
const ROOT_FLOOR = defaultTestFormat() === 'scamp' ? '' : '\n    min-height: 100vh;';
const HAND_WRITTEN_CSS = `/* Written by hand. This comment must survive. */
:root {
    --card-gap: 12px;
}

.root {
    width: 100%;${ROOT_FLOOR}
    position: relative;
}

@supports (display: grid) {
    .root { display: block; }
}

/* The box the test moves. */
.rect_seed {
    position: absolute;
    left: 40px;
    top: 40px;
    width: 120px;
    height: 80px;
    background: #cccccc;
}
`;
const HAND_WRITTEN_TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      {/* A comment inside the markup. */}
      <div data-scamp-id="rect_seed" className={styles.rect_seed} />
    </div>
  );
}
`;
test.describe('a design change rewrites only the rules it changed', () => {
    test.use({
        projectOptions: {
            pageContent: { home: { tsx: HAND_WRITTEN_TSX, css: HAND_WRITTEN_CSS } },
        },
    });
    test('keeps the comments, the custom properties, and the @supports block', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Move the seeded box: one element, one rule.
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 100, y: 80 }, { x: 260, y: 220 });
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // What Scamp never wrote is still there, formatting and all.
        expect(css).toContain('/* Written by hand. This comment must survive. */');
        expect(css).toContain('--card-gap: 12px;');
        expect(css).toContain('@supports (display: grid)');
        expect(css).toContain('/* The box the test moves. */');
        expect(css).toContain('    width: 100%;');
        // And the rule that changed did change.
        expect(css).toMatch(/\.rect_seed\s*\{[^}]*left:\s*\d+px/);
        expect(css).not.toContain('left: 40px');
    });
    test('leaves the stylesheet untouched when nothing about the rules changed', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const before = (await readPageFiles(project.dir, project.pageName)).css;
        expect(before).toBe(HAND_WRITTEN_CSS);
        // Select and deselect: canvas activity, no model change.
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 100, y: 80 }, { x: 100, y: 80 });
        await window.waitForTimeout(1500);
        expect((await readPageFiles(project.dir, project.pageName)).css).toBe(before);
    });
});
