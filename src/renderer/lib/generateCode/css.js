// generateCode/css.ts — split out of generateCode.ts (4.5).
import { ELEMENT_STATES } from "../element";
import { breakpointOverrideLines, elementDeclarationLines } from "./declarations";
import { classNameFor, computeElementsNeedingPositioningContext } from "./internal";
import { DESKTOP_BREAKPOINT_ID } from "@shared/types";
/** True when the override object has any field set — used to decide
 *  whether an @media block needs a rule for this element. Type guard
 *  so callers get a narrowed non-undefined value. */
const overrideHasAny = (override) => override !== undefined && Object.keys(override).length > 0;
const collectElementsDfs = (elements, rootId) => {
    const result = [];
    const visit = (id) => {
        const el = elements[id];
        if (!el)
            return;
        result.push(el);
        for (const childId of el.childIds)
            visit(childId);
    };
    visit(rootId);
    return result;
};
/**
 * Emit a single state's pseudo-class block for an element. Returns
 * `null` when the override is empty / produces no declarations so the
 * caller can drop it from the chunk.
 *
 * State overrides reuse `breakpointOverrideLines` because the two
 * shapes are structurally compatible — `StateOverride` is a subset of
 * `BreakpointOverride`'s fields, and the lines emitter only acts on
 * keys actually present in the object.
 */
const stateBlockFor = (el, state, override) => {
    if (Object.keys(override).length === 0)
        return null;
    const lines = breakpointOverrideLines(override, el);
    if (lines.length === 0)
        return null;
    const body = lines.map((line) => line.length === 0 ? "" : `  ${line}`).join('\n');
    return `.${classNameFor(el)}:${state} {\n${body}\n}`;
};
/**
 * Build the chunk of CSS for a single element: its base class block
 * followed by any recognised state blocks (`:hover` → `:active` →
 * `:focus`) and finally any pseudo-class blocks the parser preserved
 * verbatim. The chunks are concatenated by `generateCss` to give
 * per-element grouping in the output file.
 */
const elementCssChunks = (el, parent, mustEstablishPositioningContext = false) => {
    // Component instances don't own a class block — their visual
    // styles live inside the component definition's own
    // `[Name].module.css`. The instance JSX carries no `className`
    // and the page CSS module should NOT emit an empty `.…  {}` for
    // it.
    if (el.type === 'component-instance')
        return [];
    const chunks = [];
    const baseLines = elementDeclarationLines(el, parent, mustEstablishPositioningContext);
    const baseBody = baseLines.map((line) => line.length === 0 ? "" : `  ${line}`).join('\n');
    chunks.push(`.${classNameFor(el)} {\n${baseBody}\n}`);
    const overrides = el.stateOverrides;
    if (overrides) {
        for (const state of ELEMENT_STATES) {
            const override = overrides[state];
            if (!override)
                continue;
            const block = stateBlockFor(el, state, override);
            if (block !== null)
                chunks.push(block);
        }
    }
    // Raw pseudo-class blocks — preserved verbatim from parseCode for
    // selectors Scamp doesn't model (`:focus-visible`, `:nth-child(...)`,
    // compound selectors, etc.). Emitted in their original parse order
    // so round-trips stay text-stable.
    const raw = el.customSelectorBlocks;
    if (raw && raw.length > 0) {
        for (const block of raw) {
            chunks.push(`${block.selector} {\n${block.body}\n}`);
        }
    }
    return chunks;
};
export const generateCss = (elements, rootId, breakpoints, customMediaBlocks, pageKeyframesBlocks) => {
    const ordered = collectElementsDfs(elements, rootId);
    const positioningContextIds = computeElementsNeedingPositioningContext(elements, rootId);
    // Per-element chunks — each chunk is base + state blocks + raw
    // pseudo-class blocks, in DFS order.
    const elementBlocks = ordered.flatMap((el) => {
        const parent = el.parentId ? elements[el.parentId] ?? null : null;
        return elementCssChunks(el, parent, positioningContextIds.has(el.id));
    });
    // @keyframes blocks — emitted after per-element chunks but before
    // @media blocks. Order preserved from the source (parser collects
    // them in source order; the picker appends new ones at the tail).
    const keyframesBlocks = pageKeyframesBlocks.map((block) => `@keyframes ${block.name} {\n${block.body}\n}`);
    // @media blocks — widest first (excluding desktop, which is the
    // base). Source order with max-width queries means narrower
    // breakpoints appearing later win the cascade when both match.
    const mediaBlocks = [];
    for (const bp of breakpoints) {
        if (bp.id === DESKTOP_BREAKPOINT_ID)
            continue;
        const rules = [];
        for (const el of ordered) {
            // Component instances don't own a class block at any
            // breakpoint — same reason as the base block above.
            if (el.type === 'component-instance')
                continue;
            const override = el.breakpointOverrides?.[bp.id];
            if (!overrideHasAny(override))
                continue;
            const lines = breakpointOverrideLines(override, el);
            if (lines.length === 0)
                continue;
            const body = lines.map((line) => line.length === 0 ? "" : `    ${line}`).join('\n');
            rules.push(`  .${classNameFor(el)} {\n${body}\n  }`);
        }
        if (rules.length === 0)
            continue;
        mediaBlocks.push(`@media (max-width: ${bp.width}px) {\n${rules.join('\n\n')}\n}`);
    }
    // Custom @media blocks — agent/user-written queries we don't
    // understand. Appended verbatim so they survive the round-trip.
    const customBlocks = customMediaBlocks.filter((b) => b.trim().length > 0);
    const allBlocks = [
        ...elementBlocks,
        ...keyframesBlocks,
        ...mediaBlocks,
        ...customBlocks,
    ];
    return `${allBlocks.join('\n\n')}\n`;
};
