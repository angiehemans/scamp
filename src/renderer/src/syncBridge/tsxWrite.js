import { parseCode } from '@lib/parseCode';
import { applyEdits } from '@lib/textEdits';
import { tsxEdits } from '@lib/tsxRegions';
import { tsxSurgicalEdits } from '@lib/tsxElementEdits';
const parseOptions = (input) => ({
    breakpoints: input.breakpoints,
    isComponent: input.isComponent,
});
const sameModel = (a, b, input) => {
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
const surgicalEdits = (baseTsx, input) => {
    const base = parseCode(baseTsx, input.css, parseOptions(input));
    const next = parseCode(input.generatedTsx, input.css, parseOptions(input));
    if (base.ranges === undefined || next.ranges === undefined)
        return null;
    return tsxSurgicalEdits({ text: baseTsx, elements: base.elements, ranges: base.ranges }, { text: input.generatedTsx, elements: next.elements, ranges: next.ranges });
};
export const tsxWriteFor = (input) => {
    const { baseTsx, generatedTsx } = input;
    if (baseTsx === null)
        return { tsx: generatedTsx, patched: false };
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
            console.warn('[tsxWrite] the patched view parsed differently from the generated one; writing the generated file instead.');
            return { tsx: generatedTsx, patched: false };
        }
        return { tsx: patched, patched: true };
    }
    catch (err) {
        console.warn('[tsxWrite] patching failed; writing the generated file instead:', err);
        return { tsx: generatedTsx, patched: false };
    }
};
