import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { bufferToWebpIfSmaller, isConvertible, toWebpIfSmaller, } from '../../src/main/ipc/imageOptimize';
/**
 * Real encoding against real files in a temp dir — no mocking, because
 * "is the WebP actually smaller" is the entire question and a stub can't
 * answer it. see docs/plans/image-optimization-plan.md
 */
let dir;
beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-opt-'));
});
afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
});
/**
 * A noisy image — random per-pixel colour. Photographic in the way that
 * matters here: it doesn't compress to nothing, so the size comparisons
 * are meaningful rather than an artefact of a solid-colour test image.
 */
const noisyPixels = (w, h) => {
    const buf = Buffer.alloc(w * h * 3);
    // Deterministic pseudo-random so the test can't flake on a lucky seed.
    let seed = 12345;
    for (let i = 0; i < buf.length; i += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        buf[i] = seed % 256;
    }
    return buf;
};
const writePng = async (name, w = 200, h = 200) => {
    const p = path.join(dir, name);
    await sharp(noisyPixels(w, h), { raw: { width: w, height: h, channels: 3 } })
        .png()
        .toFile(p);
    return p;
};
const writeJpeg = async (name, w = 200, h = 200) => {
    const p = path.join(dir, name);
    await sharp(noisyPixels(w, h), { raw: { width: w, height: h, channels: 3 } })
        .jpeg({ quality: 100 })
        .toFile(p);
    return p;
};
describe('isConvertible', () => {
    it('accepts the raster formats worth re-encoding', () => {
        expect(isConvertible('/a/hero.png')).toBe(true);
        expect(isConvertible('/a/hero.jpg')).toBe(true);
        expect(isConvertible('/a/hero.jpeg')).toBe(true);
    });
    it('is case-insensitive about the extension', () => {
        expect(isConvertible('/a/HERO.PNG')).toBe(true);
    });
    it('leaves webp, svg and gif alone', () => {
        // webp: re-encoding only loses quality. svg: vector. gif: animation
        // would need handling we deliberately don't have yet.
        expect(isConvertible('/a/hero.webp')).toBe(false);
        expect(isConvertible('/a/icon.svg')).toBe(false);
        expect(isConvertible('/a/loop.gif')).toBe(false);
    });
});
describe('toWebpIfSmaller', () => {
    it('converts a PNG to smaller WebP bytes', async () => {
        const src = await writePng('hero.png');
        const before = (await fs.stat(src)).size;
        const result = await toWebpIfSmaller(src);
        expect(result).not.toBeNull();
        expect(result.ext).toBe('.webp');
        expect(result.data.length).toBeLessThan(before);
    });
    it('converts a JPEG to smaller WebP bytes', async () => {
        const src = await writeJpeg('photo.jpg');
        const before = (await fs.stat(src)).size;
        const result = await toWebpIfSmaller(src);
        expect(result).not.toBeNull();
        expect(result.data.length).toBeLessThan(before);
    });
    it('keeps the pixel dimensions — this compresses, it does not resize', async () => {
        const src = await writePng('hero.png', 320, 180);
        const result = await toWebpIfSmaller(src);
        const meta = await sharp(result.data).metadata();
        expect(meta.width).toBe(320);
        expect(meta.height).toBe(180);
        expect(meta.format).toBe('webp');
    });
    it('preserves transparency', async () => {
        const src = path.join(dir, 'alpha.png');
        await sharp({
            create: {
                width: 64,
                height: 64,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 0.5 },
            },
        })
            .png()
            .toFile(src);
        const result = await toWebpIfSmaller(src);
        if (result) {
            const meta = await sharp(result.data).metadata();
            expect(meta.hasAlpha).toBe(true);
        }
        // A 64px flat square may legitimately not shrink; the assertion that
        // matters is that IF we convert, the alpha channel survives.
    });
    it('returns null for a format we do not convert', async () => {
        const svg = path.join(dir, 'icon.svg');
        await fs.writeFile(svg, '<svg xmlns="http://www.w3.org/2000/svg"/>');
        expect(await toWebpIfSmaller(svg)).toBeNull();
    });
    it('returns null rather than throwing on a file that is not an image', async () => {
        // A text file someone renamed. This runs on every import, so it must
        // degrade to "keep the original", never fail the import.
        const fake = path.join(dir, 'notreally.png');
        await fs.writeFile(fake, 'this is not a png');
        expect(await toWebpIfSmaller(fake)).toBeNull();
    });
    it('returns null when the file does not exist', async () => {
        expect(await toWebpIfSmaller(path.join(dir, 'missing.png'))).toBeNull();
    });
    it('never returns bytes that are bigger than the source', async () => {
        // The whole safety property: this runs silently, so it has to be
        // incapable of making a file worse. A tiny already-tight PNG is the
        // case where WebP tends to lose.
        const src = path.join(dir, 'tiny.png');
        await sharp({
            create: {
                width: 1,
                height: 1,
                channels: 3,
                background: { r: 0, g: 0, b: 0 },
            },
        })
            .png()
            .toFile(src);
        const before = (await fs.stat(src)).size;
        const result = await toWebpIfSmaller(src);
        if (result)
            expect(result.data.length).toBeLessThan(before);
    });
});
describe('bufferToWebpIfSmaller', () => {
    it('shrinks a PNG buffer — the clipboard-paste case', async () => {
        // Electron's `toDataURL()` always hands back PNG, so a pasted photo
        // arrives re-encoded as PNG and can be far larger than its source.
        const png = await sharp(noisyPixels(200, 200), {
            raw: { width: 200, height: 200, channels: 3 },
        })
            .png()
            .toBuffer();
        const result = await bufferToWebpIfSmaller(png);
        expect(result).not.toBeNull();
        expect(result.data.length).toBeLessThan(png.length);
    });
    it('returns null on bytes that are not an image', async () => {
        expect(await bufferToWebpIfSmaller(Buffer.from('nope'))).toBeNull();
    });
});
