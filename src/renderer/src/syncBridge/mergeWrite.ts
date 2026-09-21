import { parseCode } from '@lib/parseCode';
import { mergeText } from '@lib/threeWayMerge';
import type { ScampElement } from '@lib/element';
import type { Breakpoint } from '@shared/types';

/**
 * What to write when main refuses a save because disk has drifted.
 *
 * Before this, the refusal cost the user their edit: Scamp adopted the
 * disk version and said so. Most refusals are not disagreements, so
 * try the three-way merge first — base is the version the write
 * claimed, ours is what it carried, theirs is what disk actually holds
 * — and only fall back when the two sides touched the same lines.
 *
 * Both files have to merge for the write to go ahead. Merging one and
 * reloading the other would leave the pair describing different
 * designs. see docs/plans/incremental-writes-plan.md, phase 4
 */

type ParsedModel = ReturnType<typeof parseCode>;

export type MergeWriteInput = {
  /** The version the refused write claimed was on disk. */
  baseTsx: string;
  baseCss: string;
  /** What that write carried. */
  oursTsx: string;
  oursCss: string;
  /** What disk actually holds. */
  theirsTsx: string;
  theirsCss: string;
  breakpoints: ReadonlyArray<Breakpoint>;
  isComponent: boolean;
};

export type MergedWrite = {
  tsx: string;
  css: string;
  /** Parsed once here, so the caller can reload the canvas without repeating it. */
  parsed: ReturnType<typeof parseCode>;
  /** Regions taken from the other side, for the log line. */
  fromTheirs: number;
};

/**
 * The fields of `b` that `a` does not already agree with. Used to ask
 * "what did this save actually change", so the check below can insist
 * on those and stay indifferent to everything else.
 */
const differingKeys = (
  a: ScampElement | undefined,
  b: ScampElement
): string[] => {
  const left = a as unknown as Record<string, unknown> | undefined;
  const right = b as unknown as Record<string, unknown>;
  return Object.keys(right).filter(
    (key) => JSON.stringify(left?.[key]) !== JSON.stringify(right[key])
  );
};

/**
 * Did the design change survive the merge?
 *
 * `parseCode` is deliberately lenient — it returns a tree for almost
 * any input rather than throwing — so "it parses" proves nothing. What
 * matters is that every field this save changed reads back with the
 * value it wanted, and that no element it knew about disappeared.
 * Fields the other side changed are none of our business.
 *
 * It is conservative in one place worth naming: if both sides added a
 * child to the same parent, `childIds` reads back as neither side's
 * version and the merge is refused. That costs a merge that a person
 * would have accepted, and the cost is the behaviour we had before
 * this phase, not a damaged file.
 */
const changeSurvived = (
  base: ParsedModel,
  ours: ParsedModel,
  merged: ParsedModel
): boolean => {
  for (const [id, ourElement] of Object.entries(ours.elements)) {
    const mergedElement = merged.elements[id];
    if (mergedElement === undefined) return false;
    const mergedFields = mergedElement as unknown as Record<string, unknown>;
    const ourFields = ourElement as unknown as Record<string, unknown>;
    for (const key of differingKeys(base.elements[id], ourElement)) {
      if (JSON.stringify(mergedFields[key]) !== JSON.stringify(ourFields[key])) {
        return false;
      }
    }
  }
  return true;
};

export const mergeWrite = (input: MergeWriteInput): MergedWrite | null => {
  const tsx = mergeText(input.baseTsx, input.oursTsx, input.theirsTsx);
  if (!tsx.ok) return null;
  const css = mergeText(input.baseCss, input.oursCss, input.theirsCss);
  if (!css.ok) return null;

  const options = {
    breakpoints: input.breakpoints,
    isComponent: input.isComponent,
  };
  try {
    const parsed = parseCode(tsx.text, css.text, options);
    // The safety valve. The two files merge independently, so nothing
    // so far has checked that they still describe the same design.
    const survived = changeSurvived(
      parseCode(input.baseTsx, input.baseCss, options),
      parseCode(input.oursTsx, input.oursCss, options),
      parsed
    );
    if (!survived) return null;
    return {
      tsx: tsx.text,
      css: css.text,
      parsed,
      fromTheirs: tsx.fromTheirs + css.fromTheirs,
    };
  } catch {
    return null;
  }
};
