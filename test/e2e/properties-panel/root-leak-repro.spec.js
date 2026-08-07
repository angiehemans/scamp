import { test, expect } from '../fixtures/app';
import { commitInput, drawAndSelectRect, panelInputByPrefix, panelSection, } from '../fixtures/panel';
import { switchBreakpoint } from '../fixtures/breakpoints';
import { clickInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * REPRO: setting a value on a selected element is reported to also apply it
 * to the page root. Asserts the root's CSS block is untouched.
 */
/** The `.root { … }` block only. */
const rootBlock = (css) => {
    const start = css.indexOf('.root {');
    if (start === -1)
        throw new Error(`no .root block in:\n${css}`);
    return css.slice(start, css.indexOf('}', start) + 1);
};
test.describe('REPRO: element edits leaking onto the root', () => {
    test('setting gap on a flex child does not add gap to .root', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 300, y: 220 });
        await waitForSaved(window);
        await panelSection(window, 'Layout')
            .getByRole('radio', { name: 'Flex row' })
            .click();
        await waitForSaved(window);
        await commitInput(panelInputByPrefix(window, 'Layout', 'Gap'), '24');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css, 'element should have the gap').toMatch(new RegExp(`\\.${className}[^}]*gap:\\s*24px`, 's'));
        expect(rootBlock(css), 'root must NOT have gained a gap').not.toContain('gap');
    });
    test('setting padding on a child does not add padding to .root', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 300, y: 220 });
        await waitForSaved(window);
        await commitInput(panelInputByPrefix(window, 'Spacing', 'Padding'), '16');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css, 'element should have the padding').toMatch(new RegExp(`\\.${className}[^}]*padding:\\s*16px`, 's'));
        expect(rootBlock(css), 'root must NOT have gained padding').not.toContain('padding');
    });
    test('the root keeps its own values when a child is edited', async ({ window, project, }) => {
        // The case most like the report: root is itself a flex container, so it
        // already owns a gap, and editing a child must not overwrite it.
        await expect(pageRoot(window)).toBeVisible();
        // Coordinate click: the canvas chrome overlay swallows locator clicks,
        // and clicking bare canvas selects the root.
        await selectTool(window, 'v');
        await clickInFrame(window, { x: 500, y: 400 });
        await panelSection(window, 'Layout')
            .getByRole('radio', { name: 'Flex row' })
            .click();
        await waitForSaved(window);
        await commitInput(panelInputByPrefix(window, 'Layout', 'Gap'), '8');
        await waitForSaved(window);
        const className = await drawAndSelectRect(window, { x: 120, y: 120 }, { x: 280, y: 200 });
        await waitForSaved(window);
        await panelSection(window, 'Layout')
            .getByRole('radio', { name: 'Flex row' })
            .click();
        await waitForSaved(window);
        await commitInput(panelInputByPrefix(window, 'Layout', 'Gap'), '40');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css, 'child gets its own gap').toMatch(new RegExp(`\\.${className}[^}]*gap:\\s*40px`, 's'));
        expect(rootBlock(css), 'root keeps ITS gap, not the child edit').toContain('gap: 8px');
    });
    test('padding set at a non-desktop breakpoint does not reach .root', async ({ window, project, }) => {
        // `applyPatchWithAxisRouting` reroutes edits into breakpointOverrides —
        // the path most likely to misattribute an element.
        await expect(pageRoot(window)).toBeVisible();
        const className = await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 260, y: 200 });
        await waitForSaved(window);
        await switchBreakpoint(window, 'tablet', 'Tablet');
        await commitInput(panelInputByPrefix(window, 'Spacing', 'Padding'), '12');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css, 'child gets the tablet override').toMatch(new RegExp(`\\.${className}[^}]*padding:\\s*12px`, 's'));
        expect(rootBlock(css), 'root block untouched').not.toContain('padding');
        // And no `.root` rule inside the media block either.
        const media = css.slice(css.indexOf('@media'));
        expect(media, 'no root override in the media block').not.toContain('.root');
    });
    test('editing a NESTED element does not reach .root', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 400, y: 320 });
        await waitForSaved(window);
        // Draw a second rect inside the first, then edit the inner one.
        const inner = await drawAndSelectRect(window, { x: 120, y: 120 }, { x: 260, y: 240 });
        await waitForSaved(window);
        await commitInput(panelInputByPrefix(window, 'Spacing', 'Padding'), '20');
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        expect(css).toMatch(new RegExp(`\\.${inner}[^}]*padding:\\s*20px`, 's'));
        expect(rootBlock(css), 'root block untouched').not.toContain('padding');
    });
});
