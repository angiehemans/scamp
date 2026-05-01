import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { switchBreakpoint } from '../fixtures/breakpoints';
import { commitInput, drawAndSelectRect, panelInputByPrefix, } from '../fixtures/panel';
import { canvasElement, pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
test.describe('breakpoints: CSS output', () => {
    test('Tablet + Mobile overrides emit widest-first @media blocks', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '24');
        await waitForSaved(window);
        await switchBreakpoint(window, 'tablet', 'Tablet');
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '12');
        await waitForSaved(window);
        await switchBreakpoint(window, 'mobile', 'Mobile');
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '8');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        const tabletIdx = css.indexOf('@media (max-width: 768px)');
        const mobileIdx = css.indexOf('@media (max-width: 390px)');
        expect(tabletIdx).toBeGreaterThan(-1);
        expect(mobileIdx).toBeGreaterThan(-1);
        // Widest first — tablet (768) appears before mobile (390).
        expect(tabletIdx).toBeLessThan(mobileIdx);
        // Each media block carries only the overridden property.
        const tabletBlock = css.slice(tabletIdx, mobileIdx);
        const mobileBlock = css.slice(mobileIdx);
        expect(tabletBlock).toMatch(/padding:\s*12px 12px 12px 12px/);
        expect(mobileBlock).toMatch(/padding:\s*8px 8px 8px 8px/);
        // Base class still reads 24px.
        const baseBlock = css.slice(0, tabletIdx);
        expect(baseBlock).toMatch(new RegExp(`\\.${className}\\s*\\{[^}]*padding:\\s*24px`));
    });
    test('unknown @media queries round-trip verbatim', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '16');
        await waitForSaved(window);
        // Open the code panel — it mirrors pageSource, which the sync
        // bridge updates on every external file change. Gives us an
        // observable signal that the external write has been parsed before
        // we kick off another canvas edit.
        await window.getByRole('button', { name: /^Code\s/ }).click();
        await expect(window.getByText('home.module.css', { exact: true })).toBeVisible();
        // Append a min-width media block externally — Scamp should preserve
        // it through subsequent saves without trying to interpret it.
        const cssPath = path.join(project.dir, 'home.module.css');
        const original = await fs.readFile(cssPath, 'utf-8');
        const customMedia = `\n@media (min-width: 1600px) {\n  .${className} {\n    padding: 48px 48px 48px 48px;\n  }\n}\n`;
        await fs.writeFile(cssPath, original + customMedia, 'utf-8');
        // Wait for the sync bridge to reparse — the code panel will render
        // the new `min-width: 1600px` declaration once it's in pageSource.
        await expect(window.getByText(/min-width:\s*1600px/).first()).toBeVisible({
            timeout: 10_000,
        });
        // Now a canvas edit. Regenerated CSS should still include the
        // custom @media block we appended externally.
        await commitInput(panelInputByPrefix(window, 'Spacing', 'P'), '18');
        await waitForSaved(window);
        const finalCss = await fs.readFile(cssPath, 'utf-8');
        expect(finalCss).toContain('@media (min-width: 1600px)');
        expect(finalCss).toMatch(/padding:\s*48px 48px 48px 48px/);
        expect(finalCss).toMatch(new RegExp(`\\.${className}\\s*\\{[^}]*padding:\\s*18px`));
        await expect(canvasElement(window, className)).toBeVisible();
    });
});
