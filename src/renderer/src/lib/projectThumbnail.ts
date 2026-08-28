import {
  needsBackfill,
  thumbnailFrame,
  type ThumbnailFrame,
} from '@lib/thumbnailCrop';

import { capturePng } from './exportCapture';

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

const inFlight = new Set<string>();

const findCanvasFrame = (): HTMLElement | null => {
  const node = document.querySelector('[data-testid="canvas-frame"]');
  return node instanceof HTMLElement ? node : null;
};

/** The page's own background, for the strip below a short page. */
const backgroundOf = (node: HTMLElement): string => {
  const paint = globalThis.getComputedStyle(node).backgroundColor;
  // `transparent` / `rgba(…, 0)` would leave the backfill see-through,
  // which reads as a broken image on a dark card.
  if (!paint || paint === 'transparent' || paint.endsWith(', 0)')) {
    return '#ffffff';
  }
  return paint;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Thumbnail image failed to decode'));
    img.src = src;
  });

/** Draw the capture into a card-shaped canvas and return a PNG data URL. */
const cropToCard = async (
  sourceDataUrl: string,
  frame: ThumbnailFrame,
  background: string
): Promise<string | null> => {
  const img = await loadImage(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = frame.outWidth;
  canvas.height = frame.outHeight;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;
  if (needsBackfill(frame)) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, frame.outWidth, frame.outHeight);
  }
  ctx.drawImage(
    img,
    frame.sx,
    frame.sy,
    frame.sWidth,
    frame.sHeight,
    frame.dx,
    frame.dy,
    frame.dWidth,
    frame.dHeight
  );
  return canvas.toDataURL('image/png');
};

export type CaptureProjectThumbnailInputs = {
  projectPath: string;
  /** The page that was just saved. Anything but home is ignored. */
  pageName: string;
};

/** Fire-and-forget; never blocks the underlying save. */
export const captureAndPersistProjectThumbnail = (
  inputs: CaptureProjectThumbnailInputs
): void => {
  if (inputs.pageName !== THUMBNAIL_PAGE_NAME) return;
  if (inFlight.has(inputs.projectPath)) return;
  inFlight.add(inputs.projectPath);

  void (async () => {
    try {
      const node = findCanvasFrame();
      if (!node) return;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const frame = thumbnailFrame({
        sourceWidth: width,
        sourceHeight: height,
      });
      // Null means the frame had no size — normal mid-teardown.
      if (frame === null) return;

      const background = backgroundOf(node);
      const captured = await capturePng({
        node,
        backgroundColor: background,
        width,
        height,
        scale: 1,
      });
      const cropped = await cropToCard(captured, frame, background);
      if (cropped === null) return;

      const result = await window.scamp.writeProjectThumbnail({
        projectPath: inputs.projectPath,
        dataUrl: cropped,
      });
      if (!result.ok) {
        console.warn('[projectThumbnail] write failed', result.error);
      }
    } catch (err) {
      console.warn('[projectThumbnail] capture failed', err);
    } finally {
      inFlight.delete(inputs.projectPath);
    }
  })();
};
