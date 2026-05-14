import { promises as fs } from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/app';
import { drawAndSelectRect } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
/**
 * External CSS edits compose with history: each external write
 * lands as a single "External edit detected" entry on the current
 * page's stack. Cmd+Z immediately afterwards undoes back to the
 * state before the agent's change.
 *
 * (This used to be a "clears-on-external-edit" spec — the old
 * zundo-based stack was wiped on every external reload. The
 * visual-history panel replaced that with an additive entry so
 * agent edits remain reversible.)
 */
test.describe('history: external edits become entries, not wipes', () => {
    test('Cmd+Z after an external CSS edit restores the prior width', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 220, y: 180 });
        await waitForSaved(window);
        // Open the code panel so we have an observable signal for when
        // the sync bridge finishes reparsing the external edit.
        await window.getByRole('button', { name: /^Code$/ }).click();
        // Capture the original width emitted by Scamp.
        const cssPath = path.join(project.dir, 'home.module.css');
        const original = await fs.readFile(cssPath, 'utf-8');
        const widthMatch = original.match(new RegExp(`\\.${className}\\s*\\{[^}]*width:\\s*(\\d+)px`, 's'));
        expect(widthMatch).not.toBeNull();
        const originalWidth = widthMatch[1];
        // Rewrite the CSS externally to a different width.
        const edited = original.replace(new RegExp(`(\\.${className}\\s*\\{[^}]*width:\\s*)\\d+px`), '$1333px');
        expect(edited).not.toBe(original);
        await fs.writeFile(cssPath, edited, 'utf-8');
        // Wait for the external change to land in the code panel
        // (proxy for "sync bridge has processed it").
        await expect(window.getByText(/width:\s*333px/).first()).toBeVisible({
            timeout: 10_000,
        });
        // Cmd+Z — should now restore the original width via the
        // history entry the external edit created.
        await window.keyboard.press('ControlOrMeta+z');
        await waitForSaved(window);
        // Disk content reverts to the pre-external width.
        const afterUndo = await fs.readFile(cssPath, 'utf-8');
        expect(afterUndo).toMatch(new RegExp(`\\.${className}[^}]*width:\\s*${originalWidth}px`, 's'));
        expect(afterUndo).not.toMatch(/width:\s*333px/);
    });
});
