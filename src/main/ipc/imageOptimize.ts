import { promises as fs } from 'fs';
import { createRequire } from 'module';
import { Worker } from 'worker_threads';
import { extname, join } from 'path';

/**
 * Re-encode an imported image to WebP, when that actually helps.
 *
 * Same pixels, fewer bytes — no resizing. Imports land in the project
 * byte-for-byte otherwise, so a 4MB camera JPEG is served at 4MB and
 * backed up at 4MB.
 *
 * Uses the WebAssembly codecs rather than a native encoder. libvips —
 * what sharp is built on — is a GObject library, and Chromium on Linux
 * uses GLib too; the two corrupt each other's GObject state and take the
 * main process down after a handful of encodes. WASM shares nothing with
 * the host, so it can't have that conflict.
 * see docs/plans/image-optimization-plan.md
 */

/** Quality for the lossy encode. 80 is the usual photographic sweet spot. */
const WEBP_QUALITY = 80;

/**
 * Above this, only the lossy encode is attempted.
 *
 * Lossless is for flat graphic content — screenshots, logos, UI art —
 * where it beats PNG and is pixel-identical. On a photograph it loses
 * badly AND costs the most: a 12MP photo took 6.7s to produce 7.2MB,
 * larger than its own 2.8MB source, so the result was always going to be
 * discarded. Flat art that benefits is small; photographs are big.
 */
const LOSSLESS_MAX_PIXELS = 4_000_000;

/**
 * Longest edge we keep. A 12000px-wide photo renders at maybe 1200-2000
 * CSS pixels — roughly 2400-4000 device pixels on a retina screen at full
 * bleed — so everything above this is bytes and encode time spent on
 * detail nobody can see. 3000 covers 2x retina at a 1440 canvas with
 * headroom.
 *
 * Measured on a 96MP (12000x8002) source: 2.94MB in 30.7s at native
 * resolution, 0.45MB in 0.67s capped. Quality alone fixes neither — q70
 * at native is still 2.18MB and 28s.
 * see docs/plans/image-import-speed-plan.md
 */
const MAX_LONG_EDGE = 3000;

/**
 * The size to encode at, or null to leave the image alone.
 *
 * Only ever shrinks: an image already within the cap is untouched, and
 * nothing is upscaled. Aspect ratio is preserved, so the short edge is
 * rounded rather than forced.
 */
export const targetDimensions = (
  width: number,
  height: number
): { width: number; height: number } | null => {
  const longest = Math.max(width, height);
  if (!(longest > MAX_LONG_EDGE)) return null;
  const scale = MAX_LONG_EDGE / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/**
 * Is a lossless encode worth attempting for this image?
 *
 * A JPEG source is already lossy, so a lossless re-encode of one can only
 * preserve compression artefacts at great expense — the decoded format
 * decides this, not the file extension, since an extension can lie.
 */
export const shouldTryLossless = (
  decodedAs: 'png' | 'jpeg',
  width: number,
  height: number
): boolean => decodedAs === 'png' && width * height <= LOSSLESS_MAX_PIXELS;

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
 * Resolve a file inside an installed package.
 *
 * The codecs fetch their `.wasm` by URL by default, which has no answer
 * for a local file, so we hand them the bytes instead — which means
 * locating the files ourselves. `__dirname` exists in the bundled (CJS)
 * main process and resolves inside the packaged asar; the `cwd` branch
 * covers the ESM shim the tests run against.
 */
const requireFrom = createRequire(
  join(typeof __dirname === 'string' ? __dirname : process.cwd(), 'index.js')
);

/**
 * The encode runs in a worker thread, because WASM runs synchronously on
 * whatever thread calls it: a timer ticking every 10ms during a 420ms
 * encode got ZERO ticks. On the main thread that means a 12MP import
 * freezes the whole app — no IPC, no saves, no redraw — for the duration.
 * see docs/plans/image-import-speed-plan.md
 *
 * The worker body is a string rather than a second bundled entry point.
 * electron-vite emits main as one bundle, so a separate worker file would
 * have to be found on disk at runtime — inside the asar in a packaged
 * build, which is exactly the kind of works-in-dev-fails-when-packaged
 * trap this feature has already hit once. A string has no path to get
 * wrong, and every module it needs is resolved by the parent and handed
 * over as an absolute path.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const { readFileSync } = require('fs');
const { pathToFileURL } = require('url');

let codecs = null;

const bytesOf = (p) => {
  const file = readFileSync(p);
  const out = new Uint8Array(file.byteLength);
  out.set(file);
  return out;
};

/** Exact area average by an integer factor. See the call site for why. */
const boxDownscale = (img, factor) => {
  const W = Math.floor(img.width / factor);
  const H = Math.floor(img.height / factor);
  const out = new Uint8ClampedArray(W * H * 4);
  const src = img.data;
  const sw = img.width;
  const n = factor * factor;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      const sy0 = y * factor;
      const sx0 = x * factor;
      for (let dy = 0; dy < factor; dy++) {
        let i = ((sy0 + dy) * sw + sx0) * 4;
        for (let dx = 0; dx < factor; dx++) {
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
          i += 4;
        }
      }
      const o = (y * W + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return { data: out, width: W, height: H };
};

/**
 * Area-average resample to an arbitrary smaller size.
 *
 * Separable (horizontal then vertical) with fractional coverage at the
 * edges, which is the correct filter for downscaling — each output pixel
 * is the true average of the source region it covers.
 *
 * This replaced the wasm resampler because that one's cost scales with
 * OUTPUT pixels and its filter support: ~3.4s for any 3000px result,
 * whether the source was 12MP or 96MP. This does the same work in a
 * fraction of that. Only ever used to shrink; targetDimensions() never
 * returns anything larger.
 */
const areaResample = (img, dstW, dstH) => {
  const { data: src, width: sw, height: sh } = img;
  const tmp = new Float32Array(dstW * sh * 4);
  const sx = sw / dstW;
  for (let y = 0; y < sh; y++) {
    const row = y * sw;
    for (let x = 0; x < dstW; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      const i1 = Math.min(sw, Math.ceil(x1));
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let i = Math.floor(x0); i < i1; i++) {
        const w = Math.min(x1, i + 1) - Math.max(x0, i);
        const s = (row + i) * 4;
        r += src[s] * w; g += src[s + 1] * w; b += src[s + 2] * w; a += src[s + 3] * w;
        wsum += w;
      }
      const o = (y * dstW + x) * 4;
      tmp[o] = r / wsum; tmp[o + 1] = g / wsum; tmp[o + 2] = b / wsum; tmp[o + 3] = a / wsum;
    }
  }

  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const sy = sh / dstH;
  for (let y = 0; y < dstH; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    const j1 = Math.min(sh, Math.ceil(y1));
    for (let x = 0; x < dstW; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let j = Math.floor(y0); j < j1; j++) {
        const w = Math.min(y1, j + 1) - Math.max(y0, j);
        const s = (j * dstW + x) * 4;
        r += tmp[s] * w; g += tmp[s + 1] * w; b += tmp[s + 2] * w; a += tmp[s + 3] * w;
        wsum += w;
      }
      const o = (y * dstW + x) * 4;
      out[o] = r / wsum; out[o + 1] = g / wsum; out[o + 2] = b / wsum; out[o + 3] = a / wsum;
    }
  }
  return { data: out, width: dstW, height: dstH };
};

const load = async () => {
  if (codecs) return codecs;
  const [png, jpeg, webp] = await Promise.all([
    import(pathToFileURL(workerData.modules.png).href),
    import(pathToFileURL(workerData.modules.jpeg).href),
    import(pathToFileURL(workerData.modules.webp).href),
  ]);
  await Promise.all([
    png.init(bytesOf(workerData.wasm.png)),
    jpeg.init({ wasmBinary: bytesOf(workerData.wasm.jpeg) }),
    webp.init({ wasmBinary: bytesOf(workerData.wasm.webp) }),
  ]);
  codecs = { png: png.default, jpeg: jpeg.default, webp: webp.default };
  return codecs;
};

parentPort.on('message', async (job) => {
  try {
    const c = await load();
    const view = job.bytes.buffer.slice(
      job.bytes.byteOffset,
      job.bytes.byteOffset + job.bytes.byteLength
    );
    const order = job.preferJpeg
      ? [['jpeg', c.jpeg], ['png', c.png]]
      : [['png', c.png], ['jpeg', c.jpeg]];
    let image = null;
    let decodedAs = null;
    for (const [name, decoder] of order) {
      try {
        image = await decoder(view);
        decodedAs = name;
        break;
      } catch (err) {
        // Try the other codec before giving up — an extension can lie.
      }
    }
    if (!image) {
      parentPort.postMessage({ id: job.id, ok: true, result: null });
      return;
    }
    // Mirrors targetDimensions() in the parent — the tested statement of
    // this rule — with the cap passed in so the two can't drift.
    const longest = Math.max(image.width, image.height);
    const target =
      longest > job.maxLongEdge
        ? {
            width: Math.max(1, Math.round(image.width * (job.maxLongEdge / longest))),
            height: Math.max(1, Math.round(image.height * (job.maxLongEdge / longest))),
          }
        : null;
    // Downscale when the source is bigger than anything that will be
    // displayed.
    //
    // Two stages, because the wasm resampler's cost scales with SOURCE
    // pixels: on a 96MP photo it takes ~3.4s, while an integer box
    // average in plain JS does the same 4x reduction in ~0.34s. Box
    // averaging IS the correct filter for an integer downscale — it's
    // exact area averaging, so no aliasing — and it leaves at most a
    // sub-2x remainder for the resampler to finish on a much smaller
    // image.
    if (target) {
      const factor = Math.floor(
        Math.min(image.width / target.width, image.height / target.height)
      );
      if (factor >= 2) image = boxDownscale(image, factor);
      if (image.width !== target.width || image.height !== target.height) {
        image = areaResample(image, target.width, target.height);
      }
    }
    // Mirrors shouldTryLossless() in the parent, which is where the rule
    // is documented and tested; the threshold is passed in so the two
    // can't drift on the number.
    const tryLossless =
      decodedAs === 'png' &&
      image.width * image.height <= job.losslessMaxPixels;
    const outs = [await c.webp(image, { quality: job.quality })];
    if (tryLossless) outs.push(await c.webp(image, { lossless: 1 }));
    const best = outs.reduce((a, b) => (b.byteLength < a.byteLength ? b : a));
    parentPort.postMessage({ id: job.id, ok: true, result: best }, [best]);
  } catch (err) {
    parentPort.postMessage({ id: job.id, ok: false });
  }
});
`;

type Pending = (result: ArrayBuffer | null) => void;

let worker: Worker | null | undefined;
let nextJobId = 0;
const pending = new Map<number, Pending>();

/** Resolve every in-flight job to "no compression" and drop the worker. */
const abandonWorker = (): void => {
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
  worker = null;
};

/**
 * Start the worker, or return null if it can't run.
 *
 * `imageOptimize` is reached from `main/index.ts` via `registerImageIpc`,
 * so nothing here may throw into app startup — a failure degrades to
 * "images import uncompressed", which is the behaviour from before this
 * feature.
 */
const getWorker = (): Worker | null => {
  if (worker !== undefined) return worker;
  try {
    const spawned = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        modules: {
          png: requireFrom.resolve('@jsquash/png/decode'),
          jpeg: requireFrom.resolve('@jsquash/jpeg/decode'),
          webp: requireFrom.resolve('@jsquash/webp/encode'),
        },
        wasm: {
          png: requireFrom.resolve('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'),
          jpeg: requireFrom.resolve('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'),
          // The SIMD build: 1.7x faster, byte-identical output.
          webp: requireFrom.resolve('@jsquash/webp/codec/enc/webp_enc_simd.wasm'),
        },
      },
    });
    spawned.on('message', (msg: { id: number; ok: boolean; result?: ArrayBuffer }) => {
      const resolve = pending.get(msg.id);
      if (!resolve) return;
      pending.delete(msg.id);
      resolve(msg.ok ? (msg.result ?? null) : null);
    });
    // A crashed or exited worker must not leave an import hanging.
    spawned.on('error', abandonWorker);
    spawned.on('exit', abandonWorker);
    // Don't hold the process open for an idle worker.
    spawned.unref();
    worker = spawned;
  } catch {
    worker = null;
  }
  return worker;
};

const encodeSmaller = async (
  bytes: Buffer,
  sourceSize: number,
  preferJpeg: boolean
): Promise<{ data: Buffer; ext: '.webp' } | null> => {
  const active = getWorker();
  if (!active) return null;

  const id = (nextJobId += 1);
  const best = await new Promise<ArrayBuffer | null>((resolve) => {
    pending.set(id, resolve);
    try {
      active.postMessage({
        id,
        bytes,
        preferJpeg,
        quality: WEBP_QUALITY,
        losslessMaxPixels: LOSSLESS_MAX_PIXELS,
        maxLongEdge: MAX_LONG_EDGE,
      });
    } catch {
      pending.delete(id);
      resolve(null);
    }
  });

  if (!best) return null;
  if (best.byteLength >= sourceSize) return null;
  return { data: Buffer.from(best), ext: '.webp' };
};

/**
 * Encode `sourcePath` as WebP and return the bytes, or null to keep the
 * original.
 *
 * Null whenever converting isn't a clear win — an unconvertible type, a
 * file that isn't a decodable image, or a WebP that came out no smaller
 * than the source. That last case is the point: this runs silently on
 * every import, so it has to be incapable of making a file worse.
 */
export const toWebpIfSmaller = async (
  sourcePath: string
): Promise<{ data: Buffer; ext: '.webp' } | null> => {
  if (!isConvertible(sourcePath)) return null;
  try {
    const bytes = await fs.readFile(sourcePath);
    return await encodeSmaller(
      bytes,
      bytes.length,
      extname(sourcePath).toLowerCase() !== '.png'
    );
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
  encodeSmaller(data, data.length, false);
