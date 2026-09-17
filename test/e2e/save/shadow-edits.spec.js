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
    // The claim this test exists for: on the real save path, applying the
    // derived edits reproduced the generated text every time.
    expect(measured.divergences).toBe(0);
    // And they address less than the whole file. How much less depends on
    // how much file there is, which incrementalWrites.test.ts measures on
    // a realistic page; a two-element page is mostly change.
    expect(measured.linesTouched).toBeGreaterThan(0);
    expect(measured.linesTouched).toBeLessThan(measured.linesWritten);
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
