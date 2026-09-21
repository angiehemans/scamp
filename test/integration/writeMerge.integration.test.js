import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { mergeWrite } from '@renderer/src/syncBridge/mergeWrite';
import { checkWriteConflict } from '../../src/main/ipc/fileConflict';
import { makeRect, makeRoot } from './fixtures/elements';
/**
 * A refused write, merged instead of discarded. The whole loop on real
 * files: Scamp and an agent both start from the same version, the agent
 * writes first, Scamp's write is refused, and the merge decides whether
 * both changes land. see docs/plans/incremental-writes-plan.md, phase 4
 */
const MERGE_OPTIONS = { breakpoints: [], isComponent: false };
const page = (width) => ({
    [ROOT_ELEMENT_ID]: makeRoot(['a1b2', 'c3d4']),
    a1b2: makeRect({ id: 'a1b2', x: 100, y: 50, widthValue: width, heightValue: 300 }),
    c3d4: makeRect({ id: 'c3d4', x: 20, y: 400, widthValue: 100, heightValue: 100 }),
});
const generate = (elements) => generateCode({ elements, rootId: ROOT_ELEMENT_ID, pageName: 'home' });
describe('merging a refused write', () => {
    let tmpDir;
    let tsxPath;
    let cssPath;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-merge-'));
        tsxPath = path.join(tmpDir, 'home.tsx');
        cssPath = path.join(tmpDir, 'home.module.css');
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    /** Put the base version on disk and return it. */
    const seed = async () => {
        const base = generate(page(400));
        await fs.writeFile(tsxPath, base.tsx, 'utf-8');
        await fs.writeFile(cssPath, base.css, 'utf-8');
        return base;
    };
    it('lands both an agent rewriting the view and a designer resizing a box', async () => {
        const base = await seed();
        // The agent adds a loader above the component. Nothing Scamp owns.
        const agentTsx = base.tsx.replace('export default function Home()', 'export const load = async () => ({ items: [] });\n\nexport default function Home()');
        await fs.writeFile(tsxPath, agentTsx, 'utf-8');
        // Meanwhile the designer resized a box, and that write is refused.
        const ours = generate(page(560));
        const conflict = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: base.tsx,
            expectedCssContent: base.css,
        });
        expect(conflict).not.toBeNull();
        const merged = mergeWrite({
            baseTsx: base.tsx,
            baseCss: base.css,
            oursTsx: ours.tsx,
            oursCss: ours.css,
            theirsTsx: conflict?.actualTsxContent ?? '',
            theirsCss: conflict?.actualCssContent ?? '',
            ...MERGE_OPTIONS,
        });
        expect(merged).not.toBeNull();
        expect(merged?.tsx).toContain('export const load =');
        expect(merged?.css).toContain('width: 560px');
        // The merged version writes cleanly against what disk now holds.
        await fs.writeFile(tsxPath, merged?.tsx ?? '', 'utf-8');
        await fs.writeFile(cssPath, merged?.css ?? '', 'utf-8');
        const after = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: merged?.tsx ?? '',
            expectedCssContent: merged?.css ?? '',
        });
        expect(after).toBeNull();
        // And the canvas reloads to the resized box, not the old one.
        const parsed = parseCode(merged?.tsx ?? '', merged?.css ?? '', MERGE_OPTIONS);
        expect(parsed.elements['a1b2']?.widthValue).toBe(560);
    });
    it('lands an agent editing one rule while the designer moves another element', async () => {
        const base = await seed();
        const agentCss = base.css.replace('.rect_c3d4 {', '.rect_c3d4 {\n  opacity: 0.5;');
        await fs.writeFile(cssPath, agentCss, 'utf-8');
        const moved = page(400);
        moved['a1b2'] = makeRect({ id: 'a1b2', x: 300, y: 50, widthValue: 400, heightValue: 300 });
        const ours = generate(moved);
        const conflict = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: base.tsx,
            expectedCssContent: base.css,
        });
        const merged = mergeWrite({
            baseTsx: base.tsx,
            baseCss: base.css,
            oursTsx: ours.tsx,
            oursCss: ours.css,
            theirsTsx: conflict?.actualTsxContent ?? '',
            theirsCss: conflict?.actualCssContent ?? '',
            ...MERGE_OPTIONS,
        });
        expect(merged?.css).toContain('opacity: 0.5');
        expect(merged?.css).toContain('left: 300px');
    });
    it('refuses when the agent and the designer changed the same declaration', async () => {
        const base = await seed();
        const agentCss = base.css.replace('width: 400px', 'width: 999px');
        await fs.writeFile(cssPath, agentCss, 'utf-8');
        const ours = generate(page(560));
        const conflict = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: base.tsx,
            expectedCssContent: base.css,
        });
        const merged = mergeWrite({
            baseTsx: base.tsx,
            baseCss: base.css,
            oursTsx: ours.tsx,
            oursCss: ours.css,
            theirsTsx: conflict?.actualTsxContent ?? '',
            theirsCss: conflict?.actualCssContent ?? '',
            ...MERGE_OPTIONS,
        });
        expect(merged).toBeNull();
    });
    it('refuses a merge that would not parse', async () => {
        const base = await seed();
        const broken = `${base.tsx}\n<<<<<<< not tsx\n`;
        await fs.writeFile(tsxPath, broken, 'utf-8');
        const ours = generate(page(560));
        const merged = mergeWrite({
            baseTsx: base.tsx,
            baseCss: base.css,
            oursTsx: ours.tsx,
            oursCss: ours.css,
            theirsTsx: broken,
            theirsCss: base.css,
            ...MERGE_OPTIONS,
        });
        // Either the merge itself refuses or the parse check does; what
        // matters is that nothing unparseable is offered for writing.
        if (merged !== null) {
            expect(() => parseCode(merged.tsx, merged.css, MERGE_OPTIONS)).not.toThrow();
        }
    });
    it('keeps the agent version when the designer changed nothing', async () => {
        const base = await seed();
        const agentTsx = base.tsx.replace('export default function Home()', '// agent was here\nexport default function Home()');
        const merged = mergeWrite({
            baseTsx: base.tsx,
            baseCss: base.css,
            oursTsx: base.tsx,
            oursCss: base.css,
            theirsTsx: agentTsx,
            theirsCss: base.css,
            ...MERGE_OPTIONS,
        });
        expect(merged?.tsx).toBe(agentTsx);
        expect(merged?.css).toBe(base.css);
    });
});
describe('the safety valve', () => {
    /**
     * The two files merge independently, so each can succeed while the
     * pair stops describing one design. This is the case that catches it:
     * the agent deleted an element from the view, and the design change
     * was to that element's style.
     */
    it('refuses when the agent deleted the element the design change is about', () => {
        const base = generate(page(400));
        const ours = generate(page(560));
        const theirsTsx = base.tsx
            .split('\n')
            .filter((line) => !line.includes('rect_a1b2'))
            .join('\n');
        expect(mergeWrite({
            baseTsx: base.tsx,
            baseCss: base.css,
            oursTsx: ours.tsx,
            oursCss: ours.css,
            theirsTsx,
            theirsCss: base.css,
            ...MERGE_OPTIONS,
        })).toBeNull();
    });
});
