/**
 * Sizing maths for start-screen project thumbnails.
 *
 * A page capture is whatever shape the page is — often 1200 wide and
 * several thousand tall. A card is a fixed, wide-ish rectangle. Squashing
 * one into the other turns a landing page into an unreadable smear, so the
 * capture is cropped instead: full width, top-aligned, cut off at the card
 * aspect. The top of a page is the part that identifies it.
 *
 * Pages shorter than the card aspect are NOT stretched or cropped
 * horizontally — they are drawn at the top and the remainder is left for
 * the caller to fill with the page background. A short page on a tall
 * viewport looks exactly like that in a browser too.
 *
 * see docs/notes/project-thumbnails.md
 */

/** Card image area, 16:10. Mirrored by `--thumb-aspect` in StartScreen.module.css. */
export const THUMBNAIL_ASPECT = 16 / 10;

/**
 * Stored width. Roughly 2× the widest a card gets (the grid is
 * `minmax(220px, 1fr)`), so the image stays sharp on a retina display
 * without storing a full-size page capture in every project folder.
 */
export const THUMBNAIL_MAX_WIDTH = 640;

export type ThumbnailFrame = {
  /** Region of the capture to copy. Always the full width, from the top. */
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  /** Size of the image to write. Always exactly the target aspect. */
  outWidth: number;
  outHeight: number;
  /** Where the copied region lands. Shorter than `outHeight` when the page is short. */
  dx: number;
  dy: number;
  dWidth: number;
  dHeight: number;
};

export type ThumbnailFrameInputs = {
  sourceWidth: number;
  sourceHeight: number;
  aspect?: number;
  maxWidth?: number;
};

const isUsable = (n: number): boolean => Number.isFinite(n) && n > 0;

/**
 * Work out what to copy where. Returns null for anything we cannot make an
 * image out of — a zero-sized canvas frame is normal during teardown, so
 * the caller treats null as "skip this capture", not as an error.
 */
export const thumbnailFrame = ({
  sourceWidth,
  sourceHeight,
  aspect = THUMBNAIL_ASPECT,
  maxWidth = THUMBNAIL_MAX_WIDTH,
}: ThumbnailFrameInputs): ThumbnailFrame | null => {
  if (!isUsable(sourceWidth) || !isUsable(sourceHeight)) return null;
  if (!isUsable(aspect) || !isUsable(maxWidth)) return null;

  // Never upscale: the capture is a raster, and enlarging it only costs
  // bytes. A narrow page produces a correspondingly narrow thumbnail.
  const outWidth = Math.round(Math.min(maxWidth, sourceWidth));
  const outHeight = Math.max(1, Math.round(outWidth / aspect));
  const scale = outWidth / sourceWidth;

  // How much of the source fits in the frame, in source pixels.
  const cropHeight = Math.min(sourceHeight, outHeight / scale);
  const dHeight = Math.min(outHeight, Math.round(cropHeight * scale));

  return {
    sx: 0,
    sy: 0,
    sWidth: sourceWidth,
    sHeight: cropHeight,
    outWidth,
    outHeight,
    dx: 0,
    dy: 0,
    dWidth: outWidth,
    dHeight,
  };
};

/** True when the page did not fill the frame and the rest needs painting. */
export const needsBackfill = (frame: ThumbnailFrame): boolean =>
  frame.dHeight < frame.outHeight;
