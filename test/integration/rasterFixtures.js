import { promises as fs } from 'fs';
import sharp from 'sharp';
const toSharp = (image) => sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), {
    raw: { width: image.width, height: image.height, channels: 4 },
});
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
/** A flat, single-colour square — for the alpha and no-gain cases. */
export const flatImage = (width, height, alpha = 255) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 3] = alpha;
    }
    return { data, width, height };
};
export const pngBytes = (image) => toSharp(image).png().toBuffer();
export const jpegBytes = (image, quality = 95) => toSharp(image).jpeg({ quality }).toBuffer();
export const webpBytes = (image, quality = 80) => toSharp(image).webp({ quality }).toBuffer();
/** Decode WebP back to pixels, so tests can check what was produced. */
export const decodeWebp = async (bytes) => {
    const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return {
        data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
        width: info.width,
        height: info.height,
    };
};
export const writePng = async (filePath, image) => {
    await fs.writeFile(filePath, await pngBytes(image));
    return filePath;
};
export const writeJpeg = async (filePath, image, quality = 95) => {
    await fs.writeFile(filePath, await jpegBytes(image, quality));
    return filePath;
};
