import { applyCssChanges, cssRuleChanges } from '@lib/cssRuleEdits';
import { parseCode } from '@lib/parseCode';
/** Two parses agree when they produce the same elements. */
const sameModel = (a, b, input) => {
    const options = { breakpoints: input.breakpoints, isComponent: input.isComponent };
    const left = parseCode(input.tsx, a, options);
    const right = parseCode(input.tsx, b, options);
    // Both come from one function on one code path, so key order matches
    // and a string compare is a fair deep compare.
    return JSON.stringify(left.elements) === JSON.stringify(right.elements);
};
export const cssWriteFor = (input) => {
    const { baseCss, generatedCss } = input;
    if (baseCss === null)
        return { css: generatedCss, patched: false };
    try {
        const changes = cssRuleChanges(baseCss, generatedCss);
        if (changes.length === 0) {
            // Nothing the model cares about differs. Formatting alone is not a
            // reason to rewrite someone's file.
            return { css: baseCss, patched: true };
        }
        const patched = applyCssChanges(baseCss, changes, generatedCss);
        if (!sameModel(patched, generatedCss, input)) {
            console.warn('[cssWrite] the patched stylesheet parsed differently from the generated one; writing the generated file instead.');
            return { css: generatedCss, patched: false };
        }
        return { css: patched, patched: true };
    }
    catch (err) {
        console.warn('[cssWrite] patching failed; writing the generated file instead:', err);
        return { css: generatedCss, patched: false };
    }
};
