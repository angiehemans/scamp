import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { canvasElementsByPrefix, pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * Drawing into a flex container gave the box its drawn height and a 20px
 * width.
 *
 * `clampToParent` shrinks the width to `parentW - x` so a child cannot
 * escape its parent, which is right for an absolutely positioned child.
 * A flex or grid parent places its children itself, so the drawn offset
 * means nothing — but it was still constraining the size. Draw near the
 * right of the container and the width collapsed to `MIN_SIZE`, which is
 * 20. The height survived because the same arithmetic against a tall
 * parent had room to spare, which is why the bug looked like it only
 * affected one axis.
 *
 * see docs/notes/draw-into-flex-parent.md
 */

const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="row_flex" className={styles.row_flex}></div>
      <div data-scamp-id="row_full" className={styles.row_full}>
        <div data-scamp-id="kid_one" className={styles.kid_one}></div>
        <div data-scamp-id="kid_two" className={styles.kid_two}></div>
      </div>
      <div data-scamp-id="stretch_col" className={styles.stretch_col}></div>
    </div>
  );
}
`;

// Both containers are 500px wide so every drag below stays inside the
// window: the canvas renders unscaled here, offset ~308px from the left,
// so a frame-x much past 800 is off-screen and the mouse never lands.
const HOME_CSS = `.root {
}

.row_flex {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 500px;
  height: 280px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  background-color: rgb(240, 240, 240);
}

/* Sized by its layout, not by a pixel width — the shape every other
   fixture here was missing. A percentage width parses to stretch mode,
   and a stretch element's widthValue is an untouched 100. Reading that
   number instead of measuring the box clamped anything drawn inside to
   100px wide. Real-world case: a projects column in scamp-ui.
   (No backticks in here — this block is inside a template literal.) */
.stretch_col {
  position: absolute;
  left: 0px;
  top: 480px;
  width: 100%;
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 14px 20px 20px;
  background-color: rgb(225, 235, 245);
}

/* Two 150px children in a 500px row: adding a 180px box overflows the
   line (150 + 150 + 180 + gaps > 500), which is when flex-shrink starts
   squashing items below their own width. The kids are left narrow enough
   that there is empty row to START the drag in — beginning it on top of a
   child resolves the insert parent to the root instead. */
.row_full {
  position: absolute;
  left: 0px;
  top: 300px;
  width: 500px;
  height: 160px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  background-color: rgb(230, 240, 230);
}

.kid_one {
  width: 150px;
  height: 120px;
  background-color: rgb(200, 120, 120);
}

.kid_two {
  width: 150px;
  height: 120px;
  background-color: rgb(120, 200, 120);
}
`;

test.use({
  projectOptions: {
    format: 'nextjs',
    pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
  },
});

test.describe('canvas: drawing into a flex container', () => {
  test('a box drawn near the right edge keeps its drawn width', async ({
    window,
    project,
  }) => {
    await expect(pageRoot(window)).toBeVisible();

    // 160 wide starting at x=400 in a 500-wide flex row, so the box runs
    // 60px past the container's right edge. The old clamp shrank it to
    // 500 - 400 = 100.
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 400, y: 100 }, { x: 560, y: 240 });
    await waitForSaved(window);

    const created = canvasElementsByPrefix(window, 'rect_').first();
    const className = await created.getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');

    const css = await project.readCss();
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*160px`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*140px`, 's'));
  });

  test('a box drawn hard against the right edge is not collapsed to 20px', async ({
    window,
    project,
  }) => {
    // The reported case: started 5px from the container's right edge, so
    // `parentW - x` is 5 and the width became MIN_SIZE.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 495, y: 60 }, { x: 655, y: 200 });
    await waitForSaved(window);

    const className = await canvasElementsByPrefix(window, 'rect_')
      .first()
      .getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');

    const css = await project.readCss();
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*160px`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*140px`, 's'));
  });

  test('the box RENDERS at the size drawn, not just records it', async ({
    window,
    project,
  }) => {
    // The half that the CSS assertions above cannot see. A flex item's
    // default `flex-shrink: 1` squashes it below its own width once the
    // line overflows, so the stylesheet said 180px and the canvas drew
    // 148px — both behaving exactly as CSS specifies.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 320, y: 320 }, { x: 500, y: 440 });
    await waitForSaved(window);

    const drawn = canvasElementsByPrefix(window, 'rect_').first();
    const rendered = await drawn.evaluate(
      (el) => Math.round((el as HTMLElement).getBoundingClientRect().width)
    );
    expect(rendered).toBe(180);

    // And the opt-out is in the file, so the preview agrees with the canvas.
    const className = await drawn.getAttribute('data-scamp-id');
    const css = await project.readCss();
    expect(css).toMatch(
      new RegExp(String.raw`\.${className}[^}]*flex-shrink:\s*0`, 's')
    );
  });

  test('a box drawn at exactly the default size keeps that size', async ({
    window,
    project,
  }) => {
    // 100 is DEFAULT_RECT_STYLES.widthValue. The generator used to skip
    // any value equal to its default, so this exact box emitted no width
    // at all — and an element with no width is content-sized in a flex
    // parent, which collapsed it. Reported as "drawn at 100w but the
    // width isn't even showing in its css".
    // see docs/notes/default-omission-and-size.md
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 320, y: 320 }, { x: 420, y: 420 });
    await waitForSaved(window);

    const drawn = canvasElementsByPrefix(window, 'rect_').first();
    const className = await drawn.getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');

    const css = await project.readCss();
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*100px`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*100px`, 's'));

    const box = await drawn.evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(box).toEqual({ w: 100, h: 100 });
  });

  test('a full-width parent does not clamp the draw to 100px', async ({
    window,
    project,
  }) => {
    // `parentSizeOf` used to return the parent's MODEL widthValue, which
    // for a `width: 100%` (stretch) parent is an untouched 100 — nothing
    // to do with the rendered box. Drawing inside such a container
    // clamped the width to 100 while the height clamped against a real
    // fixed height and came through intact.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 150, y: 520 }, { x: 470, y: 660 });
    await waitForSaved(window);

    const drawn = canvasElementsByPrefix(window, 'rect_').first();
    const className = await drawn.getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');

    const css = await project.readCss();
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*320px`, 's'));
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*140px`, 's'));

    const box = await drawn.evaluate((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(box).toEqual({ w: 320, h: 140 });
  });
});

/**
 * The other half of the fix, in its own fixture: the offset clamp is
 * correct for a parent that does NOT own its children's layout, and must
 * survive. Separate because the two fixtures were competing for the
 * reachable band of the canvas — the frame renders unscaled and offset,
 * so a container pushed past ~620 frame-y is off-window and the drag
 * silently does nothing.
 */
const PLAIN_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="box_plain" className={styles.box_plain}></div>
    </div>
  );
}
`;

const PLAIN_CSS = `.root {
}

.box_plain {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 500px;
  height: 300px;
  background-color: rgb(220, 230, 240);
}
`;

test.describe('canvas: drawing into a plain container', () => {
  test.use({
    projectOptions: {
      format: 'nextjs',
      pageContent: { home: { tsx: PLAIN_TSX, css: PLAIN_CSS } },
    },
  });

  test('an absolutely positioned parent still keeps its child inside', async ({
    window,
    project,
  }) => {
    // The other half: the offset clamp is correct for a non-layout parent
    // and must survive. The same drag into a plain absolutely-positioned
    // container still shrinks to fit rather than spilling out.
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    // 370, not 400: the clamp would land on exactly 100px, which is the
    // default width and therefore omitted from the CSS entirely.
    await dragInFrame(window, { x: 370, y: 60 }, { x: 560, y: 180 });
    await waitForSaved(window);

    const className = await canvasElementsByPrefix(window, 'rect_')
      .first()
      .getAttribute('data-scamp-id');
    if (!className) throw new Error('no rect created');

    const css = await project.readCss();
    expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*130px`, 's'));
  });
});
