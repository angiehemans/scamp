import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { copyImage, assetsDirFor } from '../../src/main/ipc/imageOps';
describe('copyImage', () => {
    let projectDir;
    let sourceDir;
    let sourcePath;
    beforeEach(async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-img-'));
        projectDir = path.join(root, 'my-project');
        sourceDir = path.join(root, 'sources');
        await fs.mkdir(projectDir);
        await fs.mkdir(sourceDir);
        sourcePath = path.join(sourceDir, 'hero.png');
        await fs.writeFile(sourcePath, 'PNG-bytes', 'utf-8');
    });
    afterEach(async () => {
        await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
    });
    describe('legacy format', () => {
        it('copies into <project>/assets/ and returns ./assets/<name>', async () => {
            const result = await copyImage({ sourcePath, projectPath: projectDir }, 'legacy');
            expect(result.relativePath).toBe('./assets/hero.png');
            expect(result.fileName).toBe('hero.png');
            const dest = await fs.readFile(path.join(projectDir, 'assets', 'hero.png'), 'utf-8');
            expect(dest).toBe('PNG-bytes');
        });
        it('deduplicates filename collisions', async () => {
            await copyImage({ sourcePath, projectPath: projectDir }, 'legacy');
            const result = await copyImage({ sourcePath, projectPath: projectDir }, 'legacy');
            expect(result.fileName).toBe('hero-1.png');
            expect(result.relativePath).toBe('./assets/hero-1.png');
        });
    });
    describe('nextjs format', () => {
        it('copies into <project>/public/assets/ and returns /assets/<name>', async () => {
            const result = await copyImage({ sourcePath, projectPath: projectDir }, 'nextjs');
            expect(result.relativePath).toBe('/assets/hero.png');
            expect(result.fileName).toBe('hero.png');
            const dest = await fs.readFile(path.join(projectDir, 'public', 'assets', 'hero.png'), 'utf-8');
            expect(dest).toBe('PNG-bytes');
        });
        it('does not write to a top-level <project>/assets/ directory', async () => {
            // Defensive — dropping assets at the project root in a nextjs
            // project would produce a non-functional Next.js app.
            await copyImage({ sourcePath, projectPath: projectDir }, 'nextjs');
            const topLevelAssets = path.join(projectDir, 'assets');
            const exists = await fs
                .access(topLevelAssets)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(false);
        });
        it('deduplicates filename collisions inside public/assets/', async () => {
            await copyImage({ sourcePath, projectPath: projectDir }, 'nextjs');
            const result = await copyImage({ sourcePath, projectPath: projectDir }, 'nextjs');
            expect(result.fileName).toBe('hero-1.png');
            expect(result.relativePath).toBe('/assets/hero-1.png');
        });
    });
});
/**
 * Re-choosing a file that's already in the assets folder must reference
 * it, not clone it. All three image pickers open in that folder, so this
 * is the common path — and the dedupe loop turns it into a duplicate
 * every single time unless the import notices.
 * see docs/plans/reuse-existing-assets-plan.md
 */
describe('copyImage: a file already in the assets folder', () => {
    let projectDir;
    beforeEach(async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-img-reuse-'));
        projectDir = path.join(root, 'my-project');
        await fs.mkdir(projectDir);
    });
    afterEach(async () => {
        await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
    });
    /** Put a file in the project's assets dir and return its path. */
    const seedAsset = async (format, name = 'hero.png') => {
        const dir = assetsDirFor(projectDir, format);
        await fs.mkdir(dir, { recursive: true });
        const assetPath = path.join(dir, name);
        await fs.writeFile(assetPath, 'PNG-bytes', 'utf-8');
        return assetPath;
    };
    const assetNames = async (format) => (await fs.readdir(assetsDirFor(projectDir, format))).sort();
    it('references the existing file instead of duplicating it (legacy)', async () => {
        const assetPath = await seedAsset('legacy');
        const result = await copyImage({ sourcePath: assetPath, projectPath: projectDir }, 'legacy');
        expect(result.fileName).toBe('hero.png');
        expect(result.relativePath).toBe('./assets/hero.png');
        expect(result.reused).toBe(true);
        // The assertion that actually pins the bug: no hero-1.png.
        expect(await assetNames('legacy')).toEqual(['hero.png']);
    });
    it('references the existing file instead of duplicating it (nextjs)', async () => {
        // The two formats resolve different directories, so both need proving.
        const assetPath = await seedAsset('nextjs');
        const result = await copyImage({ sourcePath: assetPath, projectPath: projectDir }, 'nextjs');
        expect(result.relativePath).toBe('/assets/hero.png');
        expect(result.reused).toBe(true);
        expect(await assetNames('nextjs')).toEqual(['hero.png']);
    });
    it('stays at one file however many times it is re-imported', async () => {
        const assetPath = await seedAsset('legacy');
        for (let i = 0; i < 3; i += 1) {
            await copyImage({ sourcePath: assetPath, projectPath: projectDir }, 'legacy');
        }
        expect(await assetNames('legacy')).toEqual(['hero.png']);
    });
    it('is not fooled by a path that reaches the asset via ..', async () => {
        // Same file, different string — the reason this compares identity
        // rather than paths.
        const assetPath = await seedAsset('legacy');
        const indirect = path.join(path.dirname(assetPath), 'sub', '..', 'hero.png');
        await fs.mkdir(path.join(path.dirname(assetPath), 'sub'), { recursive: true });
        const result = await copyImage({ sourcePath: indirect, projectPath: projectDir }, 'legacy');
        expect(result.reused).toBe(true);
        expect(await assetNames('legacy')).toEqual(['hero.png', 'sub']);
    });
    it('still copies a DIFFERENT file that happens to share the name', async () => {
        // The behaviour that must not regress — this is what the dedupe
        // loop is actually for.
        await seedAsset('legacy');
        const otherDir = path.join(path.dirname(projectDir), 'elsewhere');
        await fs.mkdir(otherDir, { recursive: true });
        const other = path.join(otherDir, 'hero.png');
        await fs.writeFile(other, 'DIFFERENT-bytes', 'utf-8');
        const result = await copyImage({ sourcePath: other, projectPath: projectDir }, 'legacy');
        expect(result.fileName).toBe('hero-1.png');
        expect(result.reused).toBe(false);
        expect(await assetNames('legacy')).toEqual(['hero-1.png', 'hero.png']);
    });
    it('still copies a same-named file from a SUBFOLDER of assets', async () => {
        // `assets/icons/hero.png` isn't the file `./assets/hero.png` refers
        // to, so reusing the reference would point at the wrong image.
        await seedAsset('legacy');
        const iconsDir = path.join(assetsDirFor(projectDir, 'legacy'), 'icons');
        await fs.mkdir(iconsDir, { recursive: true });
        const nested = path.join(iconsDir, 'hero.png');
        await fs.writeFile(nested, 'ICON-bytes', 'utf-8');
        const result = await copyImage({ sourcePath: nested, projectPath: projectDir }, 'legacy');
        expect(result.fileName).toBe('hero-1.png');
        expect(result.reused).toBe(false);
    });
    it('matches the filesystem on a case-differing path', async () => {
        // macOS APFS is case-insensitive and Linux is not, so the SAME input
        // is legitimately a duplicate on one and a distinct file on the
        // other. Assert against what the filesystem under the test actually
        // does rather than hard-coding either answer.
        const assetPath = await seedAsset('legacy');
        const upper = path.join(path.dirname(assetPath), 'HERO.PNG');
        const caseInsensitiveFs = await fs
            .access(upper)
            .then(() => true)
            .catch(() => false);
        const result = await copyImage({ sourcePath: caseInsensitiveFs ? upper : assetPath, projectPath: projectDir }, 'legacy');
        expect(result.reused).toBe(true);
        expect(await assetNames('legacy')).toEqual(['hero.png']);
        // Crucially the reference uses the on-disk casing. Emitting the
        // chosen spelling (`./assets/HERO.PNG`) would work on the macOS dev
        // machine and 404 on a case-sensitive host.
        expect(result.fileName).toBe('hero.png');
        expect(result.relativePath).toBe('./assets/hero.png');
    });
});
describe('assetsDirFor', () => {
    it('points to public/assets for nextjs', () => {
        expect(assetsDirFor('/p', 'nextjs')).toBe(path.join('/p', 'public', 'assets'));
    });
    it('points to assets at the project root for legacy', () => {
        expect(assetsDirFor('/p', 'legacy')).toBe(path.join('/p', 'assets'));
    });
});
