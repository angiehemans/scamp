import { parseCode } from '@lib/parseCode';
import { applyEdits } from '@lib/textEdits';
import { tsxEdits } from '@lib/tsxRegions';
import type { Breakpoint } from '@shared/types';

/**
 * What a save actually writes to the view file.
 *
 * Phase 3 of docs/plans/incremental-writes-plan.md, and the twin of
 * `cssWrite.ts`. Rewrite the regions the generator owns — the styles
 * and component imports, the props type, the component itself, the
 * `_scamp` export — and leave every other byte of the file alone.
 *
 * Measured before this existed, a save on a file Scamp had not written
 * dropped an unrelated import, a module-level constant, a comment above
 * the component, and an export beside the default one. Now it keeps
 * them.
 *
 * As with the stylesheet, the patch is verified before it is offered:
 * the patched file has to parse to the same element map as the
 * generated one, or the save writes the generated file instead.
 */

export type TsxWrite = {
  tsx: string;
  /** False when the patch was skipped or failed verification. */
  patched: boolean;
};

export type TsxWriteInput = {
  /** What we believe is on disk. Null before the first save of a target. */
  baseTsx: string | null;
  generatedTsx: string;
  /** The stylesheet that goes with it, needed to parse in context. */
  css: string;
  breakpoints: ReadonlyArray<Breakpoint>;
  isComponent: boolean;
};

const sameModel = (a: string, b: string, input: TsxWriteInput): boolean => {
  const options = { breakpoints: input.breakpoints, isComponent: input.isComponent };
  const left = parseCode(a, input.css, options);
  const right = parseCode(b, input.css, options);
  return JSON.stringify(left.elements) === JSON.stringify(right.elements);
};

export const tsxWriteFor = (input: TsxWriteInput): TsxWrite => {
  const { baseTsx, generatedTsx } = input;
  if (baseTsx === null) return { tsx: generatedTsx, patched: false };
  try {
    const edits = tsxEdits(baseTsx, generatedTsx);
    if (edits.length === 0) {
      // The owned regions already say this. Formatting elsewhere is not
      // a reason to rewrite someone's file.
      return { tsx: baseTsx, patched: true };
    }
    const patched = applyEdits(baseTsx, edits);
    if (!sameModel(patched, generatedTsx, input)) {
      console.warn(
        '[tsxWrite] the patched view parsed differently from the generated one; writing the generated file instead.'
      );
      return { tsx: generatedTsx, patched: false };
    }
    return { tsx: patched, patched: true };
  } catch (err) {
    console.warn('[tsxWrite] patching failed; writing the generated file instead:', err);
    return { tsx: generatedTsx, patched: false };
  }
};
