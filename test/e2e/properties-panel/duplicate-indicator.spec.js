import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * The yellow duplicate-CSS indicator surfaces on a section title when
 * the parser saw the same CSS property declared more than once in the
 * element's class block. Editing any panel field on the affected
 * element rewrites the rule body from typed state, which collapses
 * the duplicate — and the indicator self-heals on the next parse.
 */
test.describe('properties panel: duplicate CSS indicator', () => {
    test('a duplicate height declaration lights up the Size section dot', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        // Inject a duplicate `height` declaration into the rect's class
        // block. The parser's last-applied wins (`100vh`) and the file
        // round-trips with both heights until the user edits.
        const cssPath = path.join(project.dir, 'home.module.css');
        const original = await fs.readFile(cssPath, 'utf-8');
        const withDuplicate = original.replace(new RegExp(`\\.${className}\\s*\\{`), `.${className} {\n  height: 100%;\n  height: 100vh;`);
        expect(withDuplicate).not.toBe(original);
        await fs.writeFile(cssPath, withDuplicate, 'utf-8');
        // The duplicate-dot is keyed by the section's cssProperties list;
        // the Size section owns `height` so its dot should appear after
        // the next parse cycle.
        const sizeSection = panelSection(window, 'Size');
        await expect(sizeSection.getByTestId('duplicate-dot')).toBeVisible({
            timeout: 10_000,
        });
    });
    test('editing a Size field clears the dot AND collapses the file', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        const cssPath = path.join(project.dir, 'home.module.css');
        const original = await fs.readFile(cssPath, 'utf-8');
        await fs.writeFile(cssPath, original.replace(new RegExp(`\\.${className}\\s*\\{`), `.${className} {\n  height: 100%;\n  height: 100vh;`), 'utf-8');
        const sizeSection = panelSection(window, 'Size');
        await expect(sizeSection.getByTestId('duplicate-dot')).toBeVisible({
            timeout: 10_000,
        });
        // Edit any size field — the typed-state-driven CSS rewrite drops
        // the duplicate.
        const heightInput = panelInputByPrefix(window, 'Size', 'H');
        await commitInput(heightInput, '200');
        await waitForSaved(window);
        // Indicator should clear optimistically AND on the next parse.
        await expect(sizeSection.getByTestId('duplicate-dot')).toHaveCount(0);
        const { css } = await readPageFiles(project.dir, project.pageName);
        const block = css.match(new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 's'))?.[0];
        expect(block).toBeDefined();
        // Word-boundary lookbehind so `min-height: …` doesn't match.
        const heightMatches = block.match(/(?:^|\s)height:\s*[^;]+;/gm) ?? [];
        expect(heightMatches).toHaveLength(1);
        expect(heightMatches[0]?.trim()).toBe('height: 200px;');
    });
});
