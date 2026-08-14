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

const wasm = async (spec: string): Promise<Uint8Array<ArrayBuffer>> => {
  const file = await fs.readFile(requireFrom.resolve(spec));
  const bytes = new Uint8Array(file.byteLength);
  bytes.set(file);
  return bytes;
};

export type RawImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type Encoders = {
  png: (img: RawImage) => Promise<ArrayBuffer>;
  jpeg: (img: RawImage, o?: { quality?: number }) => Promise<ArrayBuffer>;
};

let ready: Promise<Encoders> | null = null;

const encoders = async (): Promise<Encoders> => {
  ready ??= (async (): Promise<Encoders> => {
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
      png: png.default as unknown as Encoders['png'],
      jpeg: jpeg.default as unknown as Encoders['jpeg'],
    };
  })();
  return ready;
};

/**
 * Deterministic per-pixel noise. Photographic in the way that matters:
 * it doesn't compress to nothing, so the size comparisons mean something
 * rather than being an artefact of a flat test image.
 */
export const noisyImage = (width: number, height: number): RawImage => {
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
export const flatImage = (
  width: number,
  height: number,
  alpha = 255
): RawImage => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 3] = alpha;
  }
  return { data, width, height };
};

/** WebP bytes, for fixtures that must already be in the target format. */
let webpEncReady: Promise<
  (img: RawImage, o?: { quality?: number }) => Promise<ArrayBuffer>
> | null = null;

export const webpBytes = async (
  image: RawImage,
  quality = 80
): Promise<Buffer> => {
  webpEncReady ??= (async () => {
    const mod = await import('@jsquash/webp/encode');
    await mod.init({
      wasmBinary: await wasm('@jsquash/webp/codec/enc/webp_enc_simd.wasm'),
    });
    return mod.default as unknown as (
      img: RawImage,
      o?: { quality?: number }
    ) => Promise<ArrayBuffer>;
  })();
  const encode = await webpEncReady;
  return Buffer.from(await encode(image, { quality }));
};

export const pngBytes = async (image: RawImage): Promise<Buffer> =>
  Buffer.from(await (await encoders()).png(image));

export const jpegBytes = async (
  image: RawImage,
  quality = 95
): Promise<Buffer> =>
  Buffer.from(await (await encoders()).jpeg(image, { quality }));

export const writePng = async (
  filePath: string,
  image: RawImage
): Promise<string> => {
  await fs.writeFile(filePath, await pngBytes(image));
  return filePath;
};

/**
 * Decode WebP back to pixels, so tests can check what was actually
 * produced rather than trusting the encoder's word for it. Needs the
 * same explicit wasm init as the encoders — the default loader fetches
 * by URL, which has no answer for a local file.
 */
let webpReady: Promise<(data: ArrayBuffer) => Promise<RawImage>> | null = null;

export const decodeWebp = async (bytes: Buffer): Promise<RawImage> => {
  webpReady ??= (async () => {
    const mod = await import('@jsquash/webp/decode');
    await mod.init({
      wasmBinary: await wasm('@jsquash/webp/codec/dec/webp_dec.wasm'),
    });
    return mod.default as unknown as (d: ArrayBuffer) => Promise<RawImage>;
  })();
  const decode = await webpReady;
  return decode(
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer
  );
};

export const writeJpeg = async (
  filePath: string,
  image: RawImage,
  quality = 95
): Promise<string> => {
  await fs.writeFile(filePath, await jpegBytes(image, quality));
  return filePath;
};
