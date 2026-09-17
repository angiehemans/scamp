import { applyEdits, diffText, editStats } from '@lib/textEdits';
const totals = {
    saves: 0,
    divergences: 0,
    linesTouched: 0,
    linesWritten: 0,
    singleHunkSaves: 0,
};
/** The running totals for this session. Read from devtools or a test. */
export const shadowEditTotals = () => ({ ...totals });
export const resetShadowEditTotals = () => {
    totals.saves = 0;
    totals.divergences = 0;
    totals.linesTouched = 0;
    totals.linesWritten = 0;
    totals.singleHunkSaves = 0;
};
// A read-only hook for devtools and the e2e that proves this runs on
// the real save path, in the shape `__scampDisposeTerminals` already
// established for main.
try {
    globalThis.__scampShadowEdits =
        shadowEditTotals;
}
catch {
    // A frozen global is not worth failing a save over.
}
const debugEnabled = () => {
    try {
        return globalThis.localStorage?.getItem('scamp.debugWrites') === '1';
    }
    catch {
        return false;
    }
};
/**
 * Derive, verify, and measure. Never throws: this runs beside a real
 * save, and a flaw in the shadow path must not cost the user a write.
 */
export const reportShadowEdits = (targetName, files) => {
    try {
        const measured = [];
        let diverged = false;
        for (const file of files) {
            if (file.base === null)
                continue;
            const edits = diffText(file.base, file.next);
            if (applyEdits(file.base, edits) !== file.next) {
                diverged = true;
                // Loud, and not behind the flag: later phases write from this.
                console.error(`[shadowEdits] ${targetName} ${file.label}: applying the derived edits did not reproduce the generated text.`);
            }
            measured.push({ label: file.label, stats: editStats(file.base, edits) });
        }
        if (measured.length === 0)
            return;
        totals.saves += 1;
        if (diverged)
            totals.divergences += 1;
        for (const { stats } of measured) {
            totals.linesTouched += stats.linesRemoved + stats.linesAdded;
            totals.linesWritten += stats.baseLines;
        }
        const touchedFiles = measured.filter((m) => m.stats.hunks > 0);
        if (touchedFiles.length > 0 && touchedFiles.every((m) => m.stats.hunks === 1)) {
            totals.singleHunkSaves += 1;
        }
        if (debugEnabled()) {
            const summary = measured
                .map(({ label, stats }) => `${label} ${stats.hunks}h -${stats.linesRemoved}/+${stats.linesAdded} of ${stats.baseLines}`)
                .join('  ');
            console.log(`[shadowEdits] ${targetName}  ${summary}`);
        }
    }
    catch (err) {
        console.error('[shadowEdits] measurement failed:', err);
    }
};
