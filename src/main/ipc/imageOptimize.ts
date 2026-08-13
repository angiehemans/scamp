import { promises as fs } from 'fs';
import { extname } from 'path';
import sharp, { type Sharp } from 'sharp';

/**
 * Re-encode an imported image to WebP, when that actually helps.
 *
 * Same pixels, fewer bytes — no resizing. Imports land in the project
 * byte-for-byte otherwise, so a 4MB camera JPEG is served at 4MB and
 * backed up at 4MB.
 * see docs/plans/image-optimization-plan.md
 */

/** Quality for the lossy encode. 80 is the usual photographic sweet spot. */
const WEBP_QUALITY = 80;

/**
 * Extensions worth re-encoding.
 *
 *   - `.webp` is excluded: re-encoding an existing WebP only loses
 *     quality for no gain.
 *   - `.svg` is vector; minifying it is a different job.
 *   - `.gif` is excluded for now: animated GIF → animated WebP works but
 *     needs its own handling and testing, and a silent conversion that
 *     dropped the animation would be a nasty surprise.
 */
const CONVERTIBLE = new Set(['.png', '.jpg', '.jpeg']);

export const isConvertible = (sourcePath: string): boolean =>
  CONVERTIBLE.has(extname(sourcePath).toLowerCase());

/**
 * Encode `sourcePath` as WebP and return the bytes, or null to keep the
 * original.
 *
 * Null is returned whenever converting isn't a clear win — an
 * unconvertible type, a file that isn't a decodable image, or a WebP
 * that came out no smaller than the source. That last case is the point:
 * this runs silently on every import, so it has to be incapable of making
 * a file worse.
 *
 * Both a lossless and a lossy encode are tried, keeping whichever is
 * smaller, rather than guessing from the extension. A PNG might be a
 * photograph (wants lossy) or flat UI art with text (wants lossless,
 * where WebP still beats PNG and is pixel-identical) and the file
 * extension doesn't say which.
 */
const encodeSmaller = async (
  input: string | Buffer,
  sourceSize: number
): Promise<{ data: Buffer; ext: '.webp' } | null> => {
  let candidates: Buffer[];
  try {
    // `failOn: 'none'` so a slightly-malformed but renderable image still
    // converts instead of throwing — the browser would have shown it.
    const open = (): Sharp => sharp(input, { failOn: 'none' });
    candidates = await Promise.all([
      open().webp({ quality: WEBP_QUALITY }).toBuffer(),
      open().webp({ lossless: true }).toBuffer(),
    ]);
  } catch {
    // Not a decodable image (a text file renamed .png, a truncated
    // download). Leave the import alone rather than failing it.
    return null;
  }

  const best = candidates.reduce((a, b) => (b.length < a.length ? b : a));
  if (best.length >= sourceSize) return null;
  return { data: best, ext: '.webp' };
};

export const toWebpIfSmaller = async (
  sourcePath: string
): Promise<{ data: Buffer; ext: '.webp' } | null> => {
  if (!isConvertible(sourcePath)) return null;
  try {
    const { size } = await fs.stat(sourcePath);
    return await encodeSmaller(sourcePath, size);
  } catch {
    return null;
  }
};

/**
 * The same, for bytes with no file behind them — the clipboard-paste
 * path.
 *
 * Worth more here than on a normal import: Electron's `toDataURL()`
 * always hands back PNG, so pasting a photograph that was originally a
 * JPEG re-encodes it to PNG and can multiply its size. This is the one
 * place the pipeline used to actively inflate a file.
 */
export const bufferToWebpIfSmaller = async (
  data: Buffer
): Promise<{ data: Buffer; ext: '.webp' } | null> =>
  encodeSmaller(data, data.length);
