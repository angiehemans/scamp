import postcss from 'postcss';
import { PRESETS_BY_NAME, isPresetName } from './animationPresets';
/**
 * Normalise one keyframe stop selector: `from` → `0%`, `to` → `100%`,
 * everything else lower-cased and whitespace-stripped. A multi-stop
 * selector (`0%, 100%`) sorts its parts so `100%, 0%` matches `0%, 100%`.
 */
const normaliseStopSelector = (raw) => {
    const parts = raw
        .toLowerCase()
        .split(',')
        .map((s) => s.trim())
        .map((s) => (s === 'from' ? '0%' : s === 'to' ? '100%' : s))
        .filter((s) => s.length > 0)
        .sort();
    return parts.join(',');
};
/**
 * Build a normalised representation of a keyframes body for
 * structural equivalence comparison. Each keyframe stop becomes
 * `<sortedSelector>{<sortedDeclList>}`; whitespace, declaration
 * order, and `from`/`to` ↔ `0%`/`100%` differences are erased.
 *
 * Returns null for input postcss can't parse.
 */
const normaliseKeyframesBody = (body) => {
    // Wrap in a synthetic @keyframes so postcss accepts the body.
    let root;
    try {
        root = postcss.parse(`@keyframes _scamp_norm_ {\n${body}\n}`);
    }
    catch {
        return null;
    }
    const stops = [];
    root.walkAtRules('keyframes', (atRule) => {
        atRule.walkRules((rule) => {
            const selector = normaliseStopSelector(rule.selector);
            const decls = [];
            rule.walkDecls((decl) => {
                decls.push(`${decl.prop.trim().toLowerCase()}:${decl.value.trim()}`);
            });
            decls.sort();
            stops.push(`${selector}{${decls.join(';')}}`);
        });
    });
    // Sort stops so order between e.g. `0%` and `50%` doesn't matter
    // — the cascade only cares about the percentage, not source order.
    stops.sort();
    return stops.join('\n');
};
/**
 * True when `body` is structurally equivalent to the canonical body
 * of the named preset. Whitespace, declaration order, and
 * `from`/`to` ↔ `0%`/`100%` are normalised before comparison so a
 * naturally-typed agent variant doesn't get flagged as custom.
 *
 * Returns false when the name isn't a known preset OR the body fails
 * to parse OR the bodies don't match.
 */
export const matchesPreset = (name, body) => {
    if (!isPresetName(name))
        return false;
    const preset = PRESETS_BY_NAME.get(name);
    if (!preset)
        return false;
    const normalisedSource = normaliseKeyframesBody(body);
    const normalisedCanonical = normaliseKeyframesBody(preset.body);
    if (normalisedSource === null || normalisedCanonical === null)
        return false;
    return normalisedSource === normalisedCanonical;
};
export { normaliseKeyframesBody };
