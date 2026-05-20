import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { scaffoldNextjsProject } from '../../src/main/ipc/projectScaffold';
import { readComponentThumbnail, writeComponentThumbnail, } from '../../src/main/ipc/componentOps';
/**
 * Phase 9 — component thumbnail IPC handlers. The renderer ships
 * a base64-encoded PNG data URL on every component save; main
 * writes it under `<projectPath>/.scamp/component-thumbs/<Name>.png`
 * which the scaffolded `.gitignore` excludes from version control.
 */
// 1×1 transparent PNG — minimum valid bytes for a thumbnail
// fixture. Real captures come from `html-to-image` and are
// proportionally larger, but the IPC doesn't care about pixel
// dimensions.
const ONE_PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const ONE_PIXEL_PNG_DATA_URL = `data:image/png;base64,${ONE_PIXEL_PNG_BASE64}`;
describe('writeComponentThumbnail', () => {
    let projectDir;
    beforeEach(async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-thumbs-'));
        projectDir = path.join(tmp, 'my-project');
        await fs.mkdir(projectDir);
        await scaffoldNextjsProject(projectDir, 'my-project');
    });
    afterEach(async () => {
        await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
    });
    it('creates the .scamp/component-thumbs/ directory tree on first write', async () => {
        const result = await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'nextjs');
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const expected = path.join(projectDir, '.scamp', 'component-thumbs', 'Button.png');
        expect(result.thumbnailPath).toBe(expected);
        await expect(fs.access(expected)).resolves.toBeUndefined();
    });
    it('writes a valid PNG that decodes to the expected bytes', async () => {
        await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'nextjs');
        const onDisk = await fs.readFile(path.join(projectDir, '.scamp', 'component-thumbs', 'Button.png'));
        const expected = Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64');
        expect(onDisk.equals(expected)).toBe(true);
    });
    it('is idempotent when the directory already exists', async () => {
        await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'nextjs');
        // Second call: directory now exists; second write should
        // succeed and overwrite the existing PNG without throwing.
        const second = await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'nextjs');
        expect(second.ok).toBe(true);
    });
    it('rejects malformed data URLs without crashing', async () => {
        const result = await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: 'not-a-data-url',
        }, 'nextjs');
        expect(result.ok).toBe(false);
    });
    it('rejects non-PascalCase component names', async () => {
        const result = await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'lowercase',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'nextjs');
        expect(result.ok).toBe(false);
    });
    it('refuses to operate on legacy-format projects', async () => {
        await expect(writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'legacy')).rejects.toThrow();
    });
});
describe('readComponentThumbnail', () => {
    let projectDir;
    beforeEach(async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-thumbs-read-'));
        projectDir = path.join(tmp, 'my-project');
        await fs.mkdir(projectDir);
        await scaffoldNextjsProject(projectDir, 'my-project');
    });
    afterEach(async () => {
        await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
    });
    it('returns base64: null when no thumbnail has been written yet', async () => {
        const result = await readComponentThumbnail({ projectPath: projectDir, componentName: 'Button' }, 'nextjs');
        expect(result.base64).toBeNull();
    });
    it('returns the base64 PNG when present', async () => {
        await writeComponentThumbnail({
            projectPath: projectDir,
            componentName: 'Button',
            dataUrl: ONE_PIXEL_PNG_DATA_URL,
        }, 'nextjs');
        const result = await readComponentThumbnail({ projectPath: projectDir, componentName: 'Button' }, 'nextjs');
        expect(result.base64).toBe(ONE_PIXEL_PNG_BASE64);
    });
    it('returns base64: null for invalid component names instead of throwing', async () => {
        const result = await readComponentThumbnail({ projectPath: projectDir, componentName: 'lowercase' }, 'nextjs');
        expect(result.base64).toBeNull();
    });
});
describe('scaffolded .gitignore', () => {
    let projectDir;
    beforeEach(async () => {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-gitignore-'));
        projectDir = path.join(tmp, 'my-project');
        await fs.mkdir(projectDir);
    });
    afterEach(async () => {
        await fs.rm(path.dirname(projectDir), { recursive: true, force: true });
    });
    it('writes a .gitignore containing .scamp/', async () => {
        await scaffoldNextjsProject(projectDir, 'my-project');
        const content = await fs.readFile(path.join(projectDir, '.gitignore'), 'utf-8');
        expect(content).toContain('.scamp/');
        expect(content).toContain('node_modules');
        expect(content).toContain('.next');
    });
    it('does not clobber an existing .gitignore', async () => {
        // Pre-create a custom gitignore — the scaffold should leave
        // it alone.
        const existing = '# user customised\nmy-secret-folder/\n';
        await fs.writeFile(path.join(projectDir, '.gitignore'), existing, 'utf-8');
        await scaffoldNextjsProject(projectDir, 'my-project');
        const content = await fs.readFile(path.join(projectDir, '.gitignore'), 'utf-8');
        expect(content).toBe(existing);
    });
});
