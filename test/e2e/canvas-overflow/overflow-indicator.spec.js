import { test, expect } from '../fixtures/app';
import { frameOverflow, setClipContent } from '../fixtures/breakpoints';
import { canvasElement, pageRoot } from '../fixtures/selectors';
// A home page with one rectangle positioned well past the 1440px canvas
// width (left: 1800px), so the canvas has real horizontal overflow.
const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_over" className={styles.rect_over}></div>
    </div>
  );
}
`;
const HOME_CSS = `.root {
}

.rect_over {
  position: absolute;
  left: 1800px;
  top: 40px;
  width: 200px;
  height: 120px;
  background-color: rgb(68, 136, 255);
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
    },
});
const overflowIndicator = (page) => page.locator('[data-testid="overflow-indicator"]');
test.describe('canvas overflow indicator', () => {
    test('clip off: off-canvas content is on screen and flagged', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const rect = canvasElement(window, 'rect_over');
        await expect(rect).toBeVisible();
        // Content spills (not clipped) and the amber boundary indicator shows.
        expect(await frameOverflow(window)).toBe('visible');
        await expect(overflowIndicator(window)).toBeVisible();
        // Fit-to-content zoomed out enough that the overflowing element is
        // actually on screen — the whole point, so the user can see and fix it.
        await expect(rect).toBeInViewport();
    });
    test('clip on: off-canvas content is hidden and the indicator is gone', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const rect = canvasElement(window, 'rect_over');
        await setClipContent(window, true);
        expect(await frameOverflow(window)).toBe('hidden');
        await expect(overflowIndicator(window)).toHaveCount(0);
        // Clipped + fit reverts to the canvas width, so the element sits
        // off-screen past the right edge.
        await expect(rect).not.toBeInViewport();
    });
});
