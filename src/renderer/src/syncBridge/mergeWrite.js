import { parseCode } from '@lib/parseCode';
import { mergeText } from '@lib/threeWayMerge';
/**
 * The fields of `b` that `a` does not already agree with. Used to ask
 * "what did this save actually change", so the check below can insist
 * on those and stay indifferent to everything else.
 */
const differingKeys = (a, b) => {
    const left = a;
    const right = b;
    return Object.keys(right).filter((key) => JSON.stringify(left?.[key]) !== JSON.stringify(right[key]));
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
const changeSurvived = (base, ours, merged) => {
    for (const [id, ourElement] of Object.entries(ours.elements)) {
        const mergedElement = merged.elements[id];
        if (mergedElement === undefined)
            return false;
        const mergedFields = mergedElement;
        const ourFields = ourElement;
        for (const key of differingKeys(base.elements[id], ourElement)) {
            if (JSON.stringify(mergedFields[key]) !== JSON.stringify(ourFields[key])) {
                return false;
            }
        }
    }
    return true;
};
export const mergeWrite = (input) => {
    const tsx = mergeText(input.baseTsx, input.oursTsx, input.theirsTsx);
    if (!tsx.ok)
        return null;
    const css = mergeText(input.baseCss, input.oursCss, input.theirsCss);
    if (!css.ok)
        return null;
    const options = {
        breakpoints: input.breakpoints,
        isComponent: input.isComponent,
    };
    try {
        const parsed = parseCode(tsx.text, css.text, options);
        // The safety valve. The two files merge independently, so nothing
        // so far has checked that they still describe the same design.
        const survived = changeSurvived(parseCode(input.baseTsx, input.baseCss, options), parseCode(input.oursTsx, input.oursCss, options), parsed);
        if (!survived)
            return null;
        return {
            tsx: tsx.text,
            css: css.text,
            parsed,
            fromTheirs: tsx.fromTheirs + css.fromTheirs,
        };
    }
    catch {
        return null;
    }
};
