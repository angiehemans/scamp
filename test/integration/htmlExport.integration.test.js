import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { buildHtmlExport } from '@lib/htmlExport';
import { generateCode } from '@lib/generateCode';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { classifyTarget, copyAssets, writeExportFiles, writeMarker, } from '../../src/main/ipc/htmlExportOps';
/**
 * The export from end to end: real generated sources in, real files on disk
 * out. The property that matters most is the last test — every path the
 * markup references resolves to a file that actually exists, which is what
 * "the export looks like the canvas" reduces to once it's on disk.
 */
const makeRoot = (childIds) => ({
    ...DEFAULT_ROOT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds,
    x: 0,
    y: 0,
    customProperties: {},
    inlineFragments: [],
});
const makeEl = (id, overrides = {}) => ({
    ...DEFAULT_RECT_STYLES,
    id,
    type: 'rectangle',
    parentId: ROOT_ELEMENT_ID,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    inlineFragments: [],
    ...overrides,
});
const asMap = (els) => Object.fromEntries(els.map((el) => [el.id, el]));
const sourceFor = (name, els, isComponent = false) => {
    const { tsx, css } = generateCode({
        elements: asMap(els),
        rootId: ROOT_ELEMENT_ID,
        pageName: name,
        isComponent,
    });
    return { name, tsxContent: tsx, cssContent: css };
};
/** A project with two pages, a component used twice, an image and a link. */
const projectSources = () => ({
    pages: [
        sourceFor('home', [
            makeRoot(['i1', 'i2', 'img1', 'l1']),
            makeEl('i1', {
                type: 'component-instance',
                componentName: 'SidebarRow',
                instanceId: 'inst_a024',
                propOverrides: { label: 'First' },
            }),
            makeEl('i2', {
                type: 'component-instance',
                componentName: 'SidebarRow',
                instanceId: 'inst_b135',
                propOverrides: { label: 'Second' },
            }),
            makeEl('img1', {
                type: 'image',
                src: '/assets/hero.webp',
                alt: 'Hero',
            }),
            makeEl('l1', { tag: 'a', attributes: { href: '/about' } }),
        ]),
        sourceFor('about', [
            makeRoot(['img2', 'l2']),
            makeEl('img2', { type: 'image', src: '/assets/hero.webp', alt: 'Hero' }),
            makeEl('l2', { tag: 'a', attributes: { href: '/' } }),
        ]),
    ],
    components: [
        sourceFor('SidebarRow', [
            makeRoot(['d3e4']),
            makeEl('d3e4', {
                type: 'text',
                name: 'label',
                prop: 'label',
                text: 'Home',
                backgroundColor: '#00ff00',
            }),
        ], true),
    ],
});
let tmpDir;
let exportDir;
let assetsDir;
beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-html-export-'));
    exportDir = path.join(tmpDir, 'out');
    assetsDir = path.join(tmpDir, 'project', 'public', 'assets');
    await fs.mkdir(exportDir, { recursive: true });
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(path.join(assetsDir, 'hero.webp'), 'not-really-a-webp');
});
afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
});
const runExport = async () => {
    const { pages, components } = projectSources();
    const { files } = buildHtmlExport({
        projectName: 'Demo',
        pages,
        components,
        themeCss: ':root { --accent: red; }',
    });
    await writeExportFiles(exportDir, files);
    await copyAssets(assetsDir, path.join(exportDir, 'assets'));
    await writeMarker(exportDir, 'Demo', '2026-08-26T00:00:00.000Z');
};
describe('html export on disk', () => {
    it('writes the expected folder structure', async () => {
        await runExport();
        const entries = await fs.readdir(exportDir);
        expect(entries.sort()).toEqual([
            '.scamp-export',
            'about',
            'assets',
            'index.css',
            'index.html',
            'theme.css',
        ]);
        expect((await fs.readdir(path.join(exportDir, 'about'))).sort()).toEqual([
            'index.css',
            'index.html',
        ]);
    });
    it('copies the project assets', async () => {
        await runExport();
        const copied = await fs.readFile(path.join(exportDir, 'assets', 'hero.webp'), 'utf-8');
        expect(copied).toBe('not-really-a-webp');
    });
    it('copies assets from nested folders too', async () => {
        await fs.mkdir(path.join(assetsDir, 'icons'), { recursive: true });
        await fs.writeFile(path.join(assetsDir, 'icons', 'star.svg'), '<svg/>');
        await runExport();
        expect(await fs.readFile(path.join(exportDir, 'assets', 'icons', 'star.svg'), 'utf-8')).toBe('<svg/>');
    });
    it('exports without assets when the project has no assets folder', async () => {
        await fs.rm(assetsDir, { recursive: true, force: true });
        await expect(runExport()).resolves.toBeUndefined();
        expect(await fs.readdir(exportDir)).toContain('index.html');
    });
    it('leaves the exported folder recognisable to a later export', async () => {
        await runExport();
        expect(classifyTarget(await fs.readdir(exportDir))).toBe('previous-export');
    });
    it('refuses to write a file that would escape the export folder', async () => {
        await expect(writeExportFiles(exportDir, [
            { path: '../escaped.html', contents: 'nope' },
        ])).rejects.toThrow(/outside the export folder/);
        const parent = await fs.readdir(tmpDir);
        expect(parent).not.toContain('escaped.html');
    });
    it('resolves every local path the markup references', async () => {
        await runExport();
        for (const page of ['index.html', path.join('about', 'index.html')]) {
            const pageDir = path.dirname(path.join(exportDir, page));
            const html = await fs.readFile(path.join(exportDir, page), 'utf-8');
            const refs = [
                ...html.matchAll(/(?:href|src)="([^"]+)"/g),
            ].map((m) => m[1] ?? '');
            expect(refs.length).toBeGreaterThan(0);
            for (const ref of refs) {
                if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('#'))
                    continue;
                await expect(fs.access(path.resolve(pageDir, ref)), `${page} references ${ref}, which does not exist`).resolves.toBeUndefined();
            }
        }
    });
    it('links the two pages to each other', async () => {
        await runExport();
        const home = await fs.readFile(path.join(exportDir, 'index.html'), 'utf-8');
        const about = await fs.readFile(path.join(exportDir, 'about', 'index.html'), 'utf-8');
        expect(home).toContain('href="about/index.html"');
        expect(about).toContain('href="../index.html"');
    });
    it('gives each instance of the shared component its own rules', async () => {
        await runExport();
        const css = await fs.readFile(path.join(exportDir, 'index.css'), 'utf-8');
        expect(css).toContain('.inst_a024__root');
        expect(css).toContain('.inst_b135__root');
        const html = await fs.readFile(path.join(exportDir, 'index.html'), 'utf-8');
        expect(html).toContain('First');
        expect(html).toContain('Second');
        expect(html).not.toContain('SidebarRow');
    });
});
