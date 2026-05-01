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
describe('assetsDirFor', () => {
    it('points to public/assets for nextjs', () => {
        expect(assetsDirFor('/p', 'nextjs')).toBe(path.join('/p', 'public', 'assets'));
    });
    it('points to assets at the project root for legacy', () => {
        expect(assetsDirFor('/p', 'legacy')).toBe(path.join('/p', 'assets'));
    });
});
