import { parseCode } from '@lib/parseCode';
import { applyEdits, type TextEdit } from '@lib/textEdits';
import { tsxEdits } from '@lib/tsxRegions';
import { tsxSurgicalEdits } from '@lib/tsxElementEdits';
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
 * Phase 5 adds a finer path in front of that. With `parseCode`
 * reporting a range per element, a change to one element is written as
 * an edit to that element's opening tag or to the text between its
 * tags, so a hand-formatted file keeps its formatting everywhere the
 * design did not change. Whatever the elements cannot account for
 * still goes through the regions.
 *
 * Every path is verified before it is offered: the patched file has to
 * parse to the same element map as the generated one, or the save
 * falls through to the next one and finally to the generated file.
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

const parseOptions = (
  input: TsxWriteInput
): { breakpoints: ReadonlyArray<Breakpoint>; isComponent: boolean } => ({
  breakpoints: input.breakpoints,
  isComponent: input.isComponent,
});

const sameModel = (a: string, b: string, input: TsxWriteInput): boolean => {
  const left = parseCode(a, input.css, parseOptions(input));
  const right = parseCode(b, input.css, parseOptions(input));
  return JSON.stringify(left.elements) === JSON.stringify(right.elements);
};

/**
 * The element-anchored edits for this save, or null when the change is
 * not element-shaped. Both files are parsed against the same
 * stylesheet, so any element that differs between them differs because
 * of the TSX.
 */
const surgicalEdits = (
  baseTsx: string,
  input: TsxWriteInput
): TextEdit[] | null => {
  const base = parseCode(baseTsx, input.css, parseOptions(input));
  const next = parseCode(input.generatedTsx, input.css, parseOptions(input));
  if (base.ranges === undefined || next.ranges === undefined) return null;
  return tsxSurgicalEdits(
    { text: baseTsx, elements: base.elements, ranges: base.ranges },
    { text: input.generatedTsx, elements: next.elements, ranges: next.ranges }
  );
};

export const tsxWriteFor = (input: TsxWriteInput): TsxWrite => {
  const { baseTsx, generatedTsx } = input;
  if (baseTsx === null) return { tsx: generatedTsx, patched: false };
  try {
    const surgical = surgicalEdits(baseTsx, input);
    if (surgical !== null) {
      const patched = applyEdits(baseTsx, surgical);
      if (sameModel(patched, generatedTsx, input)) {
        return { tsx: patched, patched: true };
      }
    }
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
