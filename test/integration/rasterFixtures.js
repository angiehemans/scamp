import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';
/**
 * Real PNG / JPEG bytes for the image-import tests, produced with the
 * same WASM codecs the app uses — so the tests need no second image
 * library, and every fixture is guaranteed decodable by the code under
 * test. see docs/plans/image-optimization-plan.md
 */
const requireFrom = createRequire(path.join(process.cwd(), 'index.js'));
const wasm = async (spec) => {
    const file = await fs.readFile(requireFrom.resolve(spec));
    const bytes = new Uint8Array(file.byteLength);
    bytes.set(file);
    return bytes;
};
let ready = null;
const encoders = async () => {
    ready ??= (async () => {
        const [png, jpeg] = await Promise.all([
            import('@jsquash/png/encode'),
            import('@jsquash/jpeg/encode'),
        ]);
        await Promise.all([
            png.init(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
            jpeg.init({
                wasmBinary: await wasm('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'),
            }),
        ]);
        return {
            png: png.default,
            jpeg: jpeg.default,
        };
    })();
    return ready;
};
/**
 * Deterministic per-pixel noise. Photographic in the way that matters:
 * it doesn't compress to nothing, so the size comparisons mean something
 * rather than being an artefact of a flat test image.
 */
export const noisyImage = (width, height) => {
    const data = new Uint8ClampedArray(width * height * 4);
    let seed = 12345;
    for (let i = 0; i < data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = seed % 256;
        data[i + 1] = (seed >> 8) % 256;
        data[i + 2] = (seed >> 16) % 256;
        data[i + 3] = 255;
    }
    return { data, width, height };
};
/** A flat, semi-transparent square — for the alpha and no-gain cases. */
export const flatImage = (width, height, alpha = 255) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 3] = alpha;
    }
    return { data, width, height };
};
export const pngBytes = async (image) => Buffer.from(await (await encoders()).png(image));
export const jpegBytes = async (image, quality = 95) => Buffer.from(await (await encoders()).jpeg(image, { quality }));
export const writePng = async (filePath, image) => {
    await fs.writeFile(filePath, await pngBytes(image));
    return filePath;
};
/**
 * Decode WebP back to pixels, so tests can check what was actually
 * produced rather than trusting the encoder's word for it. Needs the
 * same explicit wasm init as the encoders — the default loader fetches
 * by URL, which has no answer for a local file.
 */
let webpReady = null;
export const decodeWebp = async (bytes) => {
    webpReady ??= (async () => {
        const mod = await import('@jsquash/webp/decode');
        await mod.init({
            wasmBinary: await wasm('@jsquash/webp/codec/dec/webp_dec.wasm'),
        });
        return mod.default;
    })();
    const decode = await webpReady;
    return decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};
export const writeJpeg = async (filePath, image, quality = 95) => {
    await fs.writeFile(filePath, await jpegBytes(image, quality));
    return filePath;
};
