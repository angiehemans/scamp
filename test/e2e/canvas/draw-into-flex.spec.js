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
      <div data-scamp-id="box_plain" className={styles.box_plain}></div>
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
  height: 400px;
  display: flex;
  flex-direction: row;
  gap: 12px;
  background-color: rgb(240, 240, 240);
}

.box_plain {
  position: absolute;
  left: 0px;
  top: 450px;
  width: 500px;
  height: 300px;
  background-color: rgb(220, 230, 240);
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
    },
});
test.describe('canvas: drawing into a flex container', () => {
    test('a box drawn near the right edge keeps its drawn width', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // 160 wide starting at x=400 in a 500-wide flex row, so the box runs
        // 60px past the container's right edge. The old clamp shrank it to
        // 500 - 400 = 100.
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 400, y: 100 }, { x: 560, y: 240 });
        await waitForSaved(window);
        const created = canvasElementsByPrefix(window, 'rect_').first();
        const className = await created.getAttribute('data-scamp-id');
        if (!className)
            throw new Error('no rect created');
        const css = await project.readCss();
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*160px`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*140px`, 's'));
    });
    test('a box drawn hard against the right edge is not collapsed to 20px', async ({ window, project, }) => {
        // The reported case: started 5px from the container's right edge, so
        // `parentW - x` is 5 and the width became MIN_SIZE.
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 495, y: 60 }, { x: 655, y: 200 });
        await waitForSaved(window);
        const className = await canvasElementsByPrefix(window, 'rect_')
            .first()
            .getAttribute('data-scamp-id');
        if (!className)
            throw new Error('no rect created');
        const css = await project.readCss();
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*160px`, 's'));
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*height:\\s*140px`, 's'));
    });
    test('an absolutely positioned parent still keeps its child inside', async ({ window, project, }) => {
        // The other half: the offset clamp is correct for a non-layout parent
        // and must survive. The same drag into a plain absolutely-positioned
        // container still shrinks to fit rather than spilling out.
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        // 370, not 400: the clamp would land on exactly 100px, which is the
        // default width and therefore omitted from the CSS entirely.
        await dragInFrame(window, { x: 370, y: 500 }, { x: 560, y: 620 });
        await waitForSaved(window);
        const className = await canvasElementsByPrefix(window, 'rect_')
            .first()
            .getAttribute('data-scamp-id');
        if (!className)
            throw new Error('no rect created');
        const css = await project.readCss();
        expect(css).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*130px`, 's'));
    });
});
