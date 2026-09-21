import { test, expect } from '../fixtures/app';
import { layersRowByClass } from '../fixtures/layers';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * Phase 5 of docs/plans/incremental-writes-plan.md: a change to one
 * element rewrites that element, not the function it lives in. The
 * element that did not change keeps the formatting it was written
 * with — which the region path of phase 3 could not do.
 */
const HAND_WRITTEN_TSX = `import styles from './home.module.css';
import { clsx } from 'clsx';

const TONE = 'quiet';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div
        data-scamp-id="rect_seed"
        className={styles.rect_seed}
      />
      <div
        data-scamp-id="rect_kept"
        className={styles.rect_kept}
      />
    </div>
  );
}

export const tone = TONE;
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

.rect_kept {
    position: absolute;
    left: 240px;
    top: 40px;
    width: 120px;
    height: 80px;
    background: #dddddd;
}
`;
test.describe('a change to one element rewrites only that element', () => {
    test.use({
        projectOptions: {
            pageContent: { home: { tsx: HAND_WRITTEN_TSX, css: HAND_WRITTEN_CSS } },
        },
    });
    test('leaves the untouched sibling formatted exactly as written', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Rename one element. That rewrites its opening tag and its rule.
        const row = layersRowByClass(window, 'rect_seed');
        await row.dblclick();
        const input = row.locator('input').first();
        await expect(input).toBeVisible();
        await input.fill('Hero Card');
        await input.press('Enter');
        await waitForSaved(window);
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        // The rename landed, in both files.
        expect(tsx).toMatch(/data-scamp-id="hero_card_[a-z0-9]+"/);
        expect(css).toMatch(/\.hero_card_[a-z0-9]+\s*\{/);
        expect(tsx).not.toContain('rect_seed');
        // The sibling is untouched, down to its line breaks.
        expect(tsx).toContain('      <div\n        data-scamp-id="rect_kept"\n        className={styles.rect_kept}\n      />');
        // And so is everything outside the component.
        expect(tsx).toContain("import { clsx } from 'clsx';");
        expect(tsx).toContain("const TONE = 'quiet';");
        expect(tsx).toContain('export const tone = TONE;');
    });
});
