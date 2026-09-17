import { test, expect } from '../fixtures/app';
import { dragInFrame, selectTool } from '../fixtures/canvas';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
const totals = (window) => window.evaluate(() => globalThis.__scampShadowEdits());
test('a canvas edit derives edits that reproduce the save and touch a fraction of it', async ({ window, }) => {
    await expect(pageRoot(window)).toBeVisible();
    // First save of a target has no base to diff against, so make two
    // edits: the second is the one that gets measured.
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 80, y: 80 }, { x: 260, y: 200 });
    await waitForSaved(window);
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 320, y: 80 }, { x: 500, y: 200 });
    await waitForSaved(window);
    const measured = await totals(window);
    expect(measured.saves).toBeGreaterThan(0);
    // The derivation reproduced the generated text every time.
    expect(measured.divergences).toBe(0);
    // And it would have rewritten a fraction of what the file write did.
    expect(measured.linesTouched).toBeGreaterThan(0);
    expect(measured.linesTouched).toBeLessThan(measured.linesWritten / 2);
});
test('an edit to one element is a single hunk in the file it touches', async ({ window }) => {
    await expect(pageRoot(window)).toBeVisible();
    await selectTool(window, 'r');
    await dragInFrame(window, { x: 80, y: 80 }, { x: 260, y: 200 });
    await waitForSaved(window);
    const before = await totals(window);
    // Move it: one element, one property group, one rule.
    await selectTool(window, 'v');
    await dragInFrame(window, { x: 150, y: 140 }, { x: 260, y: 240 });
    await waitForSaved(window);
    const after = await totals(window);
    expect(after.saves).toBeGreaterThan(before.saves);
    expect(after.divergences).toBe(0);
    expect(after.singleHunkSaves).toBeGreaterThan(before.singleHunkSaves);
});
