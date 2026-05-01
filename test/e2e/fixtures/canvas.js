import { canvasFrame } from './selectors';
export const measureFrame = async (page) => {
    const frame = canvasFrame(page);
    await frame.waitFor({ state: 'visible' });
    const box = await frame.boundingBox();
    if (!box)
        throw new Error('canvas frame has no bounding box');
    const canvasWidth = await frame.evaluate((el) => Number(el.dataset['canvasWidth'] ?? '0'));
    // The element's CSS width is the logical (unscaled) pixel width, so
    // the scale factor is visible-width / logical-width.
    const scale = canvasWidth > 0 ? box.width / canvasWidth : 1;
    return { rect: box, scale };
};
export const frameToClient = (metrics, point) => ({
    x: metrics.rect.x + point.x * metrics.scale,
    y: metrics.rect.y + point.y * metrics.scale,
});
/**
 * Drag from `start` to `end` in frame-local coordinates. Emits real
 * pointer events via Playwright's mouse API — the canvas interaction
 * layer captures the pointer and the draw/move/resize handlers react.
 *
 * `steps` controls the number of intermediate mouse-move events; more
 * steps make pointer-move handlers see a smooth drag. 10 is enough
 * for every draw/move/resize handler in Scamp today.
 */
export const dragInFrame = async (page, start, end, options = {}) => {
    const metrics = await measureFrame(page);
    const from = frameToClient(metrics, start);
    const to = frameToClient(metrics, end);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: options.steps ?? 10 });
    await page.mouse.up();
};
/** Click once at a frame-local coordinate. */
export const clickInFrame = async (page, point) => {
    const metrics = await measureFrame(page);
    const client = frameToClient(metrics, point);
    await page.mouse.click(client.x, client.y);
};
/** Activate a drawing tool via keyboard shortcut (r, t, f, v). */
export const selectTool = async (page, shortcut) => {
    // The toolbar listens on `window` but only when the focused node is
    // not an input/textarea/contentEditable. Click the frame first to
    // make sure focus is somewhere neutral.
    await canvasFrame(page).click({ position: { x: 1, y: 1 } });
    await page.keyboard.press(shortcut);
};
