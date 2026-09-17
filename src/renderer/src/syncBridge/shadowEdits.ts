import { applyEdits, diffText, editStats, type EditStats } from '@lib/textEdits';

/**
 * Phase 1 of docs/plans/incremental-writes-plan.md, in shadow.
 *
 * Every save still writes both files whole. Alongside it, this derives
 * the edits that save WOULD have written, checks that applying them to
 * the last-written text reproduces the generated text, and records how
 * much of each file the change actually touches.
 *
 * Two things come out of it. A divergence means the derivation is
 * wrong, and is logged loudly because later phases write from it. The
 * totals answer the question that decides whether phase 3 is worth
 * doing: how small are real changes, and how often is the whole file
 * genuinely the answer.
 *
 * Set `localStorage['scamp.debugWrites'] = '1'` to see a line per save.
 */

export type ShadowTotals = {
  /** Saves where a base was known, so edits could be derived. */
  saves: number;
  /** Times applying the edits didn't reproduce the generated text. A bug. */
  divergences: number;
  /** Lines the edits would have rewritten. */
  linesTouched: number;
  /** Lines the whole-file write rewrites instead. */
  linesWritten: number;
  /** Saves whose change was a single hunk in each file it touched. */
  singleHunkSaves: number;
};

const totals: ShadowTotals = {
  saves: 0,
  divergences: 0,
  linesTouched: 0,
  linesWritten: 0,
  singleHunkSaves: 0,
};

/** The running totals for this session. Read from devtools or a test. */
export const shadowEditTotals = (): ShadowTotals => ({ ...totals });

export const resetShadowEditTotals = (): void => {
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
  (globalThis as { __scampShadowEdits?: () => ShadowTotals }).__scampShadowEdits =
    shadowEditTotals;
} catch {
  // A frozen global is not worth failing a save over.
}

const debugEnabled = (): boolean => {
  try {
    return globalThis.localStorage?.getItem('scamp.debugWrites') === '1';
  } catch {
    return false;
  }
};

export type ShadowFile = {
  /** `tsx` or `css`, for the log line. */
  label: string;
  /** What we believe is on disk. Null before the first save of a target. */
  base: string | null;
  /** What the whole-file write is about to put there. */
  next: string;
};

/**
 * Derive, verify, and measure. Never throws: this runs beside a real
 * save, and a flaw in the shadow path must not cost the user a write.
 */
export const reportShadowEdits = (targetName: string, files: ReadonlyArray<ShadowFile>): void => {
  try {
    const measured: Array<{ label: string; stats: EditStats }> = [];
    let diverged = false;
    for (const file of files) {
      if (file.base === null) continue;
      const edits = diffText(file.base, file.next);
      if (applyEdits(file.base, edits) !== file.next) {
        diverged = true;
        // Loud, and not behind the flag: later phases write from this.
        console.error(
          `[shadowEdits] ${targetName} ${file.label}: applying the derived edits did not reproduce the generated text.`
        );
      }
      measured.push({ label: file.label, stats: editStats(file.base, edits) });
    }
    if (measured.length === 0) return;

    totals.saves += 1;
    if (diverged) totals.divergences += 1;
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
        .map(
          ({ label, stats }) =>
            `${label} ${stats.hunks}h -${stats.linesRemoved}/+${stats.linesAdded} of ${stats.baseLines}`
        )
        .join('  ');
      console.log(`[shadowEdits] ${targetName}  ${summary}`);
    }
  } catch (err) {
    console.error('[shadowEdits] measurement failed:', err);
  }
};
