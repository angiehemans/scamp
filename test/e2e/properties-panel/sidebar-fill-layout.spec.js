import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { panelSection } from '../fixtures/panel';
import { canvasElement, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The sidebar-and-main layout, end to end — the shape that exposed both
 * halves of this bug in a real project (scamp-ui's new-layout page).
 *
 * A flex-row root, a fixed-width sidebar set to fill height, a main panel
 * set to fill width. What used to happen, in the preview and (post-peel)
 * on the canvas alike:
 *
 * - Fill height emitted `height: 100%`, which resolves against the
 *   root's height — `auto` under `min-height: 100vh`, indefinite — so
 *   the sidebar rendered 0 tall and vanished.
 * - Fill width kept the draw-time `flex-shrink: 0`, so `width: 100%`
 *   was a basis that could not shrink and main overflowed the root by
 *   exactly the sidebar's width. It only looked right because the
 *   sidebar was invisible.
 *
 * Every assertion here is on RENDERED geometry. The CSS-level behaviour
 * is covered in unit tests; today's lesson is that the CSS can read
 * correctly while the canvas shows something else entirely.
 * see docs/notes/canvas-cross-axis-stretch.md
 */
// Seeded mid-layout: both children drawn (so main carries the draw-time
// flex-shrink: 0), sidebar already fixed at 287 wide. The spec then
// performs the two mode switches the user performs.
const HOME_TSX = `import styles from './page.module.css';

export default function NewLayout() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="side_nav_a001" className={styles.side_nav_a001}></div>
      <div data-scamp-id="main_a002" className={styles.main_a002}></div>
    </div>
  );
}
`;
const HOME_CSS = `.root {
  width: 100%;
  min-height: 100vh;
  display: flex;
}

.side_nav_a001 {
  width: 287px;
  height: 300px;
  background: #d5d5e5;
  flex-shrink: 0;
}

.main_a002 {
  width: 420px;
  height: 579px;
  background: #e5e5e5;
  flex-shrink: 0;
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
    },
});
const pickType = async (window, axis, option) => {
    await panelSection(window, 'Size')
        .getByRole('button', { name: `${axis} type` })
        .click();
    await window.getByRole('option', { name: option }).click();
};
const box = async (window, className) => canvasElement(window, className).evaluate((el) => {
    const r = el.getBoundingClientRect();
    // Normalise out the canvas zoom so the numbers are logical px.
    let node = el;
    while (node && node.getAttribute('data-testid') !== 'canvas-frame') {
        node = node.parentElement;
    }
    const scale = node && node.offsetWidth > 0
        ? node.getBoundingClientRect().width / node.offsetWidth
        : 1;
    return { w: Math.round(r.width / scale), h: Math.round(r.height / scale) };
});
test.describe('sidebar + main fill layout', () => {
    test('fill-height sidebar stays visible at full root height', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'v');
        await clickInFrame(window, { x: 140, y: 150 });
        await pickType(window, 'Height', 'Fill');
        await waitForSaved(window);
        // The regression: this used to become height: 100% → 0 tall → gone.
        const side = await box(window, 'side_nav_a001');
        expect(side.w).toBe(287);
        const root = await box(window, 'root');
        expect(side.h).toBe(root.h);
        expect(side.h).toBeGreaterThan(500);
        // And the file carries the form that works in a real browser.
        const css = await project.readCss();
        expect(css).toMatch(/\.side_nav_a001[^}]*align-self:\s*stretch/s);
        expect(css).not.toMatch(/\.side_nav_a001[^}]*height:\s*100%/s);
    });
    test('fill-width main takes exactly the remainder beside the sidebar', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'v');
        await clickInFrame(window, { x: 450, y: 300 });
        await pickType(window, 'Width', 'Fill');
        await waitForSaved(window);
        // Fill on the main axis releases the draw-time flex-shrink: 0;
        // without that, main renders the FULL root width and overflows past
        // the sidebar by exactly 287px.
        const root = await box(window, 'root');
        const main = await box(window, 'main_a002');
        expect(main.w).toBe(root.w - 287);
        const css = await project.readCss();
        expect(css).toMatch(/\.main_a002[^}]*width:\s*100%/s);
        expect(css).not.toMatch(/\.main_a002[^}]*flex-shrink/s);
        // The sidebar's own shrink guard is untouched — its axis never changed.
        expect(css).toMatch(/\.side_nav_a001[^}]*flex-shrink:\s*0/s);
    });
});
