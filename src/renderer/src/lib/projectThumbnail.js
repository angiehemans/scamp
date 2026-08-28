import { needsBackfill, thumbnailFrame, } from '@lib/thumbnailCrop';
import { captureIsolatedPng } from './exportCapture';
/**
 * Start-screen thumbnail capture. The component-sidebar equivalent one
 * level down is `componentThumbnail.ts`; this differs in two ways.
 *
 * It crops. A component is small and square-ish, so its capture goes to
 * disk as-is. A page is 1200 by several thousand, and a card is a wide
 * rectangle — see `@lib/thumbnailCrop` for what that means.
 *
 * And it only fires for the home page. The card's job is recognition: a
 * project should look like itself on the start screen, not like whichever
 * page you happened to stop on.
 *
 * see docs/notes/project-thumbnails.md
 */
/** The page whose capture represents the whole project. */
export const THUMBNAIL_PAGE_NAME = 'home';
const inFlight = new Set();
/**
 * Trailing debounce. A save fires on a 200ms debounce while you type, and
 * rasterising the whole page on each one is far more work than a thumbnail
 * is worth — it also competes with the canvas for the main thread, which
 * is felt as jerky zooming and dragging. One capture once the editing
 * stops is all this needs.
 */
const CAPTURE_IDLE_MS = 1500;
const pending = new Map();
const findCanvasFrame = () => {
    const node = document.querySelector('[data-testid="canvas-frame"]');
    return node instanceof HTMLElement ? node : null;
};
/** The page's own background, for the strip below a short page. */
const backgroundOf = (node) => {
    const paint = globalThis.getComputedStyle(node).backgroundColor;
    // `transparent` / `rgba(…, 0)` would leave the backfill see-through,
    // which reads as a broken image on a dark card.
    if (!paint || paint === 'transparent' || paint.endsWith(', 0)')) {
        return '#ffffff';
    }
    return paint;
};
const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Thumbnail image failed to decode'));
    img.src = src;
});
/** Draw the capture into a card-shaped canvas and return a PNG data URL. */
const cropToCard = async (sourceDataUrl, frame, background) => {
    const img = await loadImage(sourceDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = frame.outWidth;
    canvas.height = frame.outHeight;
    const ctx = canvas.getContext('2d');
    if (ctx === null)
        return null;
    if (needsBackfill(frame)) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, frame.outWidth, frame.outHeight);
    }
    ctx.drawImage(img, frame.sx, frame.sy, frame.sWidth, frame.sHeight, frame.dx, frame.dy, frame.dWidth, frame.dHeight);
    return canvas.toDataURL('image/png');
};
/** Fire-and-forget; never blocks the underlying save. */
export const captureAndPersistProjectThumbnail = (inputs) => {
    if (inputs.pageName !== THUMBNAIL_PAGE_NAME)
        return;
    const existing = pending.get(inputs.projectPath);
    if (existing !== undefined)
        clearTimeout(existing);
    pending.set(inputs.projectPath, setTimeout(() => {
        pending.delete(inputs.projectPath);
        runCapture(inputs.projectPath);
    }, CAPTURE_IDLE_MS));
};
/**
 * Run a scheduled capture now, because the project is closing and the
 * timer would otherwise fire against an unmounted canvas.
 *
 * Safe to call immediately before the unmount: the capture clones the
 * frame and detaches the copy synchronously, so the rasterising that
 * follows no longer depends on the canvas still being there. No-op when
 * nothing is scheduled — closing without editing should not rewrite an
 * identical thumbnail.
 */
export const flushPendingProjectThumbnail = (projectPath) => {
    const existing = pending.get(projectPath);
    if (existing === undefined)
        return;
    clearTimeout(existing);
    pending.delete(projectPath);
    runCapture(projectPath);
};
const runCapture = (projectPath) => {
    if (inFlight.has(projectPath))
        return;
    inFlight.add(projectPath);
    void (async () => {
        try {
            const node = findCanvasFrame();
            if (!node)
                return;
            const frame = thumbnailFrame({
                sourceWidth: node.offsetWidth,
                sourceHeight: node.offsetHeight,
            });
            // Null means the frame had no size — normal mid-teardown.
            if (frame === null)
                return;
            const background = backgroundOf(node);
            const captured = await captureIsolatedPng({
                node,
                backgroundColor: background,
            });
            if (captured === null)
                return;
            const cropped = await cropToCard(captured, frame, background);
            if (cropped === null)
                return;
            const result = await window.scamp.writeProjectThumbnail({
                projectPath,
                dataUrl: cropped,
            });
            if (!result.ok) {
                console.warn('[projectThumbnail] write failed', result.error);
            }
        }
        catch (err) {
            console.warn('[projectThumbnail] capture failed', err);
        }
        finally {
            inFlight.delete(projectPath);
        }
    })();
};
