import { parseCode } from '@lib/parseCode';
import { applyEdits } from '@lib/textEdits';
import { tsxEdits } from '@lib/tsxRegions';
const sameModel = (a, b, input) => {
    const options = { breakpoints: input.breakpoints, isComponent: input.isComponent };
    const left = parseCode(a, input.css, options);
    const right = parseCode(b, input.css, options);
    return JSON.stringify(left.elements) === JSON.stringify(right.elements);
};
export const tsxWriteFor = (input) => {
    const { baseTsx, generatedTsx } = input;
    if (baseTsx === null)
        return { tsx: generatedTsx, patched: false };
    try {
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
