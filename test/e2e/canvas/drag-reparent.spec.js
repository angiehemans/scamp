import { test, expect } from '../fixtures/app';
import { dragInFrame, frameToClient, measureFrame, selectTool, } from '../fixtures/canvas';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { layersRowByClass } from '../fixtures/layers';
import { canvasElement, canvasElementsByPrefix, pageRoot, } from '../fixtures/selectors';
import { readPageFiles, waitForSaved } from '../fixtures/assertions';
/**
 * Canvas drag-to-reparent — real pointer dragging on the canvas (distinct
 * from the layers-panel DnD covered by reorder-dnd.spec).
 * see docs/plans/canvas-drag-reparent-plan.md
 */
/** Assert `inner`'s element sits inside `outer`'s element in the TSX. */
const expectNestedInTsx = (tsx, outer, inner) => {
    const outerStart = tsx.indexOf(`data-scamp-id="${outer}"`);
    const innerStart = tsx.indexOf(`data-scamp-id="${inner}"`);
    const outerEnd = tsx.indexOf('</div>', outerStart);
    expect(outerStart).toBeGreaterThan(-1);
    expect(innerStart).toBeGreaterThan(outerStart);
    expect(innerStart).toBeLessThan(outerEnd);
};
/** The declaration body of a single class block, or '' if absent. */
const cssBlock = (css, cls) => {
    const m = css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`, 's'));
    return m?.[1] ?? '';
};
/**
 * Grab an element by its rendered centre (client coords) and drag to a
 * frame-local point. Used when the element's position isn't known ahead
 * of time (e.g. a flex child placed by layout).
 */
const dragElementToFrame = async (window, className, to) => {
    const box = await canvasElement(window, className).boundingBox();
    if (!box)
        throw new Error(`no bounding box for ${className}`);
    const metrics = await measureFrame(window);
    const target = frameToClient(metrics, to);
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await window.mouse.down();
    await window.mouse.move(target.x, target.y, { steps: 12 });
    await window.mouse.up();
};
test.describe('canvas: drag to reparent', () => {
    test('drags an absolute element into another absolute container', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Container first (drawn first → painted under the moved element).
        const containerClass = await drawAndSelectRect(window, { x: 300, y: 100 }, { x: 620, y: 420 });
        const movedClass = await drawAndSelectRect(window, { x: 60, y: 60 }, { x: 160, y: 160 });
        await waitForSaved(window);
        // Drag the element from its centre (110,110) into the container.
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 110, y: 110 }, { x: 460, y: 260 });
        await waitForSaved(window);
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        expectNestedInTsx(tsx, containerClass, movedClass);
        // Still absolutely positioned, now in the container's local space.
        const block = cssBlock(css, movedClass);
        expect(block).toMatch(/left:\s*\d+px/);
        expect(block).toMatch(/top:\s*\d+px/);
    });
    test('drags an element into a flex container (the reported bug)', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const flexClass = await drawAndSelectRect(window, { x: 300, y: 100 }, { x: 620, y: 420 });
        await panelSection(window, 'Layout')
            .getByRole('radio', { name: 'Flex row' })
            .click();
        await waitForSaved(window);
        const movedClass = await drawAndSelectRect(window, { x: 60, y: 60 }, { x: 160, y: 160 });
        await waitForSaved(window);
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 110, y: 110 }, { x: 460, y: 260 });
        await waitForSaved(window);
        const { tsx, css } = await readPageFiles(project.dir, project.pageName);
        expectNestedInTsx(tsx, flexClass, movedClass);
        // As a flex child it no longer carries absolute positioning.
        expect(cssBlock(css, movedClass)).not.toMatch(/position:\s*absolute/);
    });
    test('drags a flex child out to the page root (becomes absolute)', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Two sibling rects → group into a flex container.
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 100, y: 100 }, { x: 200, y: 200 });
        await waitForSaved(window);
        const firstClass = await canvasElementsByPrefix(window, 'rect_')
            .first()
            .getAttribute('data-scamp-id');
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 240, y: 100 }, { x: 340, y: 200 });
        await waitForSaved(window);
        const secondClass = await canvasElementsByPrefix(window, 'rect_')
            .nth(1)
            .getAttribute('data-scamp-id');
        if (!firstClass || !secondClass)
            throw new Error('need two rects');
        await layersRowByClass(window, firstClass).click();
        await layersRowByClass(window, secondClass).click({ modifiers: ['Shift'] });
        await window.keyboard.press('ControlOrMeta+g');
        await waitForSaved(window);
        // Drag the second (now-flex) child out into empty page-root space.
        // The target is well clear of the group (top-left) and on-screen.
        await selectTool(window, 'v');
        await dragElementToFrame(window, secondClass, { x: 520, y: 460 });
        await waitForSaved(window);
        const { css } = await readPageFiles(project.dir, project.pageName);
        // Out in the absolute page root it regains explicit positioning.
        const block = cssBlock(css, secondClass);
        expect(block).toMatch(/left:\s*\d+px/);
        expect(block).toMatch(/top:\s*\d+px/);
    });
    test('refuses to drop an element onto its own descendant', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        // Outer container + a smaller sibling.
        const outerClass = await drawAndSelectRect(window, { x: 80, y: 80 }, { x: 520, y: 520 });
        const innerClass = await drawAndSelectRect(window, { x: 600, y: 80 }, { x: 700, y: 180 });
        await waitForSaved(window);
        // Reparent inner INTO outer (the feature under test), landing near
        // outer's centre.
        await selectTool(window, 'v');
        await dragInFrame(window, { x: 650, y: 130 }, { x: 300, y: 300 });
        await waitForSaved(window);
        let tsx = (await readPageFiles(project.dir, project.pageName)).tsx;
        expectNestedInTsx(tsx, outerClass, innerClass);
        // Now grab outer at a spot NOT over inner (top-left) and drag the
        // cursor over inner (outer's descendant). The drop must be rejected —
        // outer can't become a child of its own child — so the nesting is
        // unchanged.
        await dragInFrame(window, { x: 120, y: 120 }, { x: 300, y: 300 });
        await waitForSaved(window);
        tsx = (await readPageFiles(project.dir, project.pageName)).tsx;
        expectNestedInTsx(tsx, outerClass, innerClass);
        // Outer is still a direct child of the page root (not nested in inner).
        const innerStart = tsx.indexOf(`data-scamp-id="${innerClass}"`);
        const outerStart = tsx.indexOf(`data-scamp-id="${outerClass}"`);
        expect(outerStart).toBeLessThan(innerStart);
    });
});
