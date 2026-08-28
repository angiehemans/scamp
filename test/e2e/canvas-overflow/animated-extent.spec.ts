import { test, expect } from '../fixtures/app';
import { canvasElement, canvasFrame, pageRoot } from '../fixtures/selectors';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { waitForSaved } from '../fixtures/assertions';

/**
 * Regression test for animated elements driving the artboard extent.
 *
 * The extent decides the fit zoom and the overflow indicator, and it was
 * measured from bounding boxes — which include the element's current
 * transform. An element with a running animation therefore reported a
 * different extent depending on when it happened to be measured, so the
 * canvas flipped between two zoom levels on every edit and the overflow
 * warning appeared and vanished with it.
 *
 * The element here rests entirely inside the 1440px canvas and only leaves
 * it mid-animation. Nothing about the design overflows; only the animation
 * frame does. Edits are spread across the animation cycle so the
 * measurement is taken at several different phases — that is what the
 * fixed code has to be indifferent to.
 *
 * see docs/notes/canvas-extent-oscillation.md
 */

const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_drift" className={styles.rect_drift}></div>
    </div>
  );
}
`;

// Rests at left 100 with width 200, so its layout box ends at 300 — far
// inside the canvas. The animation throws it 2000px right, well past the
// 1440 edge, and back again every two seconds.
const HOME_CSS = `.root {
}

.rect_drift {
  position: absolute;
  left: 100px;
  top: 40px;
  width: 200px;
  height: 120px;
  background-color: rgb(68, 136, 255);
  animation: drift 2s linear infinite;
}

@keyframes drift {
  0% {
    transform: translateX(0px);
  }
  50% {
    transform: translateX(2000px);
  }
  100% {
    transform: translateX(0px);
  }
}
`;

test.use({
  projectOptions: {
    format: 'nextjs',
    pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
  },
});

const overflowIndicator = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="overflow-indicator"]');

/** The applied zoom, read off the frame the same way the canvas does. */
const appliedScale = async (
  page: import('@playwright/test').Page
): Promise<number> =>
  canvasFrame(page).evaluate((frame) => {
    const el = frame as HTMLElement;
    const width = el.getBoundingClientRect().width;
    return el.offsetWidth > 0 ? Number((width / el.offsetWidth).toFixed(3)) : 1;
  });

test.describe('canvas extent: animated elements', () => {
  test('an element that only overflows mid-animation never reports overflow', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await expect(canvasElement(window, 'rect_drift')).toBeVisible();

    // Each edit re-measures the extent; without one the canvas never
    // looks again and this would pass with the fix removed. Spread across
    // more than a full 2s cycle, so at least one measurement lands while
    // the element is outside the canvas.
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 400, y: 400 }, { x: 500, y: 480 });
    await waitForSaved(window);

    for (let i = 0; i < 6; i += 1) {
      await window.keyboard.press('ArrowRight');
      await window.waitForTimeout(400);
      await expect(overflowIndicator(window)).toHaveCount(0);
    }
  });

  test('the zoom holds steady across edits at different animation phases', async ({
    window,
  }) => {
    await expect(canvasElement(window, 'rect_drift')).toBeVisible();
    const before = await appliedScale(window);

    // Every edit re-measures the extent. Spacing them across the cycle is
    // what made the bug show up for a user: it was not the edit that
    // mattered, it was where the animation had got to.
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 400, y: 400 }, { x: 500, y: 480 });
    await waitForSaved(window);

    for (let i = 0; i < 5; i += 1) {
      await window.keyboard.press('ArrowRight');
      await window.waitForTimeout(350);
      expect(await appliedScale(window)).toBe(before);
      await expect(overflowIndicator(window)).toHaveCount(0);
    }
  });
});
