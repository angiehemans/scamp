import { promises as fs } from 'fs';
import { createRequire } from 'module';
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
export const isConvertible = (sourcePath) => CONVERTIBLE.has(extname(sourcePath).toLowerCase());
/**
 * Resolve a file inside an installed package.
 *
 * The codecs fetch their `.wasm` by URL by default, which has no answer
 * for a local file, so we hand them the bytes instead — which means
 * locating the files ourselves. `__dirname` exists in the bundled (CJS)
 * main process and resolves inside the packaged asar; the `cwd` branch
 * covers the ESM shim the tests run against.
 */
const requireFrom = createRequire(join(typeof __dirname === 'string' ? __dirname : process.cwd(), 'index.js'));
/**
 * `undefined` = not tried yet, `null` = tried and unavailable. Cached
 * either way: the wasm only needs compiling once, and a broken install
 * shouldn't be retried on every import.
 */
let codecs;
/**
 * Load and initialise the codecs, treating "can't" as "no compression".
 *
 * Reached from `main/index.ts` via `registerImageIpc`, so a throw at
 * module scope would stop the app launching — a hard failure in exchange
 * for a nice-to-have. Failing here instead degrades to "images import
 * uncompressed", which is the behaviour from before this feature.
 */
const loadCodecs = async () => {
    if (codecs !== undefined)
        return codecs;
    try {
        // Copied into a plain ArrayBuffer-backed view: a Node Buffer may sit
        // on a pooled (or shared) buffer, which isn't a `BufferSource`.
        const wasm = async (spec) => {
            const file = await fs.readFile(requireFrom.resolve(spec));
            const bytes = new Uint8Array(file.byteLength);
            bytes.set(file);
            return bytes;
        };
        const [png, jpeg, webp] = await Promise.all([
            import('@jsquash/png/decode'),
            import('@jsquash/jpeg/decode'),
            import('@jsquash/webp/encode'),
        ]);
        // Two wasm toolchains, two init signatures: png is wasm-bindgen and
        // takes the bytes directly; jpeg and webp are Emscripten and want
        // them as `wasmBinary`.
        await Promise.all([
            png.init(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
            jpeg.init({
                wasmBinary: await wasm('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'),
            }),
            webp.init({
                wasmBinary: await wasm('@jsquash/webp/codec/enc/webp_enc.wasm'),
            }),
        ]);
        codecs = {
            png: png.default,
            jpeg: jpeg.default,
            webp: webp.default,
        };
    }
    catch {
        codecs = null;
    }
    return codecs;
};
/** Decode, trying the other codec too — a file extension can lie. */
const decode = async (bytes, codec, preferJpeg) => {
    const view = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const order = preferJpeg ? [codec.jpeg, codec.png] : [codec.png, codec.jpeg];
    for (const decoder of order) {
        try {
            return await decoder(view);
        }
        catch {
            // Try the other one before giving up.
        }
    }
    return null;
};
const encodeSmaller = async (bytes, sourceSize, preferJpeg) => {
    const codec = await loadCodecs();
    if (!codec)
        return null;
    const image = await decode(bytes, codec, preferJpeg);
    // Not a decodable image (a text file renamed .png, a truncated
    // download). Leave the import alone rather than failing it.
    if (!image)
        return null;
    let candidates;
    try {
        // Both encodes, keeping whichever is smaller, rather than guessing
        // from the extension. A PNG might be a photograph (wants lossy) or
        // flat UI art with text (wants lossless, where WebP still beats PNG
        // and is pixel-identical) and `.png` doesn't say which.
        candidates = await Promise.all([
            codec.webp(image, { quality: WEBP_QUALITY }),
            codec.webp(image, { lossless: 1 }),
        ]);
    }
    catch {
        return null;
    }
    const best = candidates.reduce((a, b) => (b.byteLength < a.byteLength ? b : a));
    if (best.byteLength >= sourceSize)
        return null;
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
export const toWebpIfSmaller = async (sourcePath) => {
    if (!isConvertible(sourcePath))
        return null;
    try {
        const bytes = await fs.readFile(sourcePath);
        return await encodeSmaller(bytes, bytes.length, extname(sourcePath).toLowerCase() !== '.png');
    }
    catch {
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
export const bufferToWebpIfSmaller = async (data) => encodeSmaller(data, data.length, false);
