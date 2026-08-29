import { test, expect } from '../fixtures/app';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import {
  canvasElementsByPrefix,
  canvasFrame,
  pageRoot,
} from '../fixtures/selectors';

/**
 * The nested-container overflow indicator.
 *
 * The root's own overflow has had an indicator for a while; a container
 * INSIDE the page whose children no longer fit had none. It spilled
 * visibly — deliberate, since auto-clipping would hide content in
 * generated code — but silently.
 *
 * The negative cases matter as much as the positive one. This ran into
 * three traps by construction:
 *
 * - `scrollWidth` is blind to `overflow: visible`, so detection is from
 *   child geometry.
 * - An animated child's bounding box moves, and measuring it would flash
 *   markers on and off through the animation — the mechanism that once
 *   flipped the artboard zoom on every edit.
 * - Anything drawn here must be canvas chrome, or it bakes into exports.
 */

const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="over_a001" className={styles.over_a001}>
        <div data-scamp-id="kid_a002" className={styles.kid_a002}></div>
        <div data-scamp-id="kid_a003" className={styles.kid_a003}></div>
      </div>
      <div data-scamp-id="fits_a004" className={styles.fits_a004}>
        <div data-scamp-id="kid_a005" className={styles.kid_a005}></div>
      </div>
      <div data-scamp-id="anim_a006" className={styles.anim_a006}>
        <div data-scamp-id="kid_a007" className={styles.kid_a007}></div>
      </div>
    </div>
  );
}
`;

const HOME_CSS = `.root {
}

/* 300 wide holding 200 + 200 with no shrink: spills by 100. */
.over_a001 {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 300px;
  height: 120px;
  display: flex;
  background-color: rgb(240, 240, 240);
}

.kid_a002 {
  width: 200px;
  height: 80px;
  flex-shrink: 0;
  background-color: rgb(200, 150, 150);
}

.kid_a003 {
  width: 200px;
  height: 80px;
  flex-shrink: 0;
  background-color: rgb(150, 200, 150);
}

/* Comfortably fits — must stay silent. */
.fits_a004 {
  position: absolute;
  left: 0px;
  top: 160px;
  width: 400px;
  height: 120px;
  display: flex;
  background-color: rgb(235, 240, 245);
}

.kid_a005 {
  width: 120px;
  height: 80px;
  flex-shrink: 0;
  background-color: rgb(150, 150, 200);
}

/* Fits at rest; the child only leaves the box mid-animation. */
.anim_a006 {
  position: absolute;
  left: 0px;
  top: 320px;
  width: 400px;
  height: 120px;
  display: flex;
  background-color: rgb(245, 240, 235);
}

.kid_a007 {
  width: 120px;
  height: 80px;
  flex-shrink: 0;
  background-color: rgb(210, 180, 140);
  animation: slide 1s linear infinite;
}

@keyframes slide {
  0% {
    transform: translateX(0px);
  }
  50% {
    transform: translateX(600px);
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

/** NB: Scamp reads a class's trailing token as the element id, so the
 *  container written as `over_a001` is addressed here as `a001`. */
const markerFor = (page: Parameters<typeof pageRoot>[0], id: string) =>
  page.locator(`[data-element-overflow="${id}"]`);

test.describe('nested container overflow', () => {
  test('marks a container whose children no longer fit', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await expect(markerFor(window, 'a001')).toBeVisible();
    // 300 wide holding 400 of children.
    await expect(markerFor(window, 'a001')).toContainText('100px');
  });

  test('stays silent for a container with room to spare', async ({
    window,
  }) => {
    await expect(pageRoot(window)).toBeVisible();
    await expect(markerFor(window, 'a001')).toBeVisible();
    await expect(markerFor(window, 'a004')).toHaveCount(0);
  });

  test('does not flicker for a child that only leaves mid-animation', async ({
    window,
  }) => {
    // Sampled across more than a full cycle. Measuring the animated
    // child's bounding box would light this on and off; layout geometry
    // does not move.
    await expect(pageRoot(window)).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await expect(markerFor(window, 'a006')).toHaveCount(0);
      await window.waitForTimeout(250);
    }
  });

  test('does not block selecting or duplicating the element beneath it', async ({
    window,
  }) => {
    // The marker layer covers the whole frame. If it intercepts pointer
    // events, nothing can be selected — and every shortcut that needs a
    // selection (duplicate, copy, cut) silently stops working.
    await expect(markerFor(window, 'a001')).toBeVisible();
    await selectTool(window, 'v');
    await clickInFrame(window, { x: 60, y: 40 }); // inside kid_a002

    // Duplicating is the assertion: Cmd+D is a no-op without a
    // selection, so this fails if the marker layer swallowed the click.
    // (Resize handles are not the tell here — a flex child does not get
    // them, since the layout owns its position.)
    const before = await canvasElementsByPrefix(window, 'kid_').count();
    await window.keyboard.press('ControlOrMeta+d');
    await expect(canvasElementsByPrefix(window, 'kid_')).toHaveCount(before + 1);
  });

  test('is canvas chrome, so it never bakes into an export', async ({
    window,
  }) => {
    await expect(markerFor(window, 'a001')).toBeVisible();
    const chromeAncestor = await markerFor(window, 'a001').evaluate(
      (el) => el.closest('[data-canvas-chrome="true"]') !== null
    );
    expect(chromeAncestor).toBe(true);

    // And it must not intercept canvas clicks.
    const clickable = await markerFor(window, 'a001').evaluate(
      (el) => globalThis.getComputedStyle(el).pointerEvents
    );
    expect(clickable).toBe('none');
  });

  test('markers sit over the container they describe', async ({ window }) => {
    await expect(markerFor(window, 'a001')).toBeVisible();
    // Scope BOTH queries to the frame. The layers panel mirrors
    // `data-element-id`, so a document-wide lookup finds its row instead
    // of the canvas element — the trap `SizeSection` documents.
    const boxes = await canvasFrame(window).evaluate((frame) => {
      const marker = frame
        .querySelector('[data-element-overflow="a001"]')
        ?.getBoundingClientRect();
      const target = frame
        .querySelector('[data-element-id="a001"]')
        ?.getBoundingClientRect();
      return marker && target
        ? {
            mx: Math.round(marker.x),
            my: Math.round(marker.y),
            tx: Math.round(target.x),
            ty: Math.round(target.y),
          }
        : null;
    });
    if (boxes === null) throw new Error('missing marker or target');
    expect(Math.abs(boxes.mx - boxes.tx)).toBeLessThanOrEqual(2);
    expect(Math.abs(boxes.my - boxes.ty)).toBeLessThanOrEqual(2);
  });
});
