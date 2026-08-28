import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { canvasElement, canvasFrame, pageRoot } from '../fixtures/selectors';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { waitForSaved } from '../fixtures/assertions';
/**
 * The start-screen thumbnail capture, which has no unit coverage because
 * it needs a real paint: `html-to-image` clones the frame, serialises it
 * into an SVG foreignObject and rasterises that.
 *
 * Two things went wrong here in one day and neither could fail a unit
 * test:
 *
 * The image came out blank, because the clone carried
 * `position: fixed; left: -100000px` and `html-to-image` serialises a node
 * with its own inline styles — so it rendered itself out of the capture
 * viewport. Asserting "a file exists" would have passed throughout; the
 * pixels are the assertion.
 *
 * And the capture mutated the live canvas, resetting the frame's transform
 * for the duration, which made the zoom jump on every save. So the frame's
 * transform is watched across a capture too.
 *
 * see docs/notes/project-thumbnails.md
 */
const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_swatch" className={styles.rect_swatch}></div>
    </div>
  );
}
`;
// A big, flat, unmistakable block of colour near the top of the page —
// inside the 16:10 crop the thumbnail takes, and nothing like the white
// a blank capture produces.
const HOME_CSS = `.root {
  background-color: rgb(255, 255, 255);
}

.rect_swatch {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 1440px;
  height: 500px;
  background-color: rgb(0, 128, 255);
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
    },
});
const thumbnailPath = (projectDir) => path.join(projectDir, '.scamp', 'preview.png');
/** Wait for the debounced capture to land, then read it. */
const waitForThumbnail = async (projectDir) => {
    const file = thumbnailPath(projectDir);
    await expect
        .poll(async () => (await fs.stat(file).catch(() => null)) !== null, {
        timeout: 20_000,
        message: 'thumbnail was never written',
    })
        .toBe(true);
    return fs.readFile(file);
};
/**
 * Decode the PNG in the renderer and count pixels close to a colour. The
 * app's own window is the most convenient canvas available, and this is
 * the only way to tell a real capture from a white rectangle.
 */
const countPixelsNear = async (window, png, rgb) => window.evaluate(async ({ base64, target }) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = `data:image/png;base64,${base64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx === null)
        return -1;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (Math.abs((data[i] ?? 0) - target[0]) < 24 &&
            Math.abs((data[i + 1] ?? 0) - target[1]) < 24 &&
            Math.abs((data[i + 2] ?? 0) - target[2]) < 24) {
            hits += 1;
        }
    }
    return hits;
}, { base64: png.toString('base64'), target: rgb });
test.describe('start-screen project thumbnail', () => {
    test('a home-page save writes a thumbnail with the page actually in it', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await expect(canvasElement(window, 'rect_swatch')).toBeVisible();
        // Any home-page save schedules the capture. Drawing a small rect is
        // the reliable way to make one — the swatch fills the canvas, so a
        // click on it lands on the interaction layer instead.
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 200, y: 600 }, { x: 260, y: 660 });
        await waitForSaved(window);
        const png = await waitForThumbnail(project.dir);
        expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
        // The regression that matters: a blank capture is a valid PNG of the
        // right size, so only the pixels distinguish it.
        const blue = await countPixelsNear(window, png, [0, 128, 255]);
        expect(blue).toBeGreaterThan(1000);
    });
    test('capturing does not disturb the canvas the user is looking at', async ({ window, project, }) => {
        await expect(canvasElement(window, 'rect_swatch')).toBeVisible();
        // Record every change to the frame's own transform from here on. The
        // old capture blanked it, which recomputed the fit zoom and made the
        // canvas visibly jump on every save.
        await canvasFrame(window).evaluate((frame) => {
            const seen = [];
            const observer = new MutationObserver(() => {
                seen.push(frame.style.transform);
            });
            observer.observe(frame, {
                attributes: true,
                attributeFilter: ['style'],
            });
            globalThis.__transforms = seen;
        });
        const before = await canvasFrame(window).evaluate((frame) => frame.style.transform);
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 200, y: 600 }, { x: 260, y: 660 });
        await waitForSaved(window);
        await waitForThumbnail(project.dir);
        const transforms = await window.evaluate(() => globalThis.__transforms);
        // `none` is what the old code set on the live frame mid-capture.
        expect(transforms).not.toContain('none');
        expect(transforms.filter((t) => t !== before)).toEqual([]);
    });
});
