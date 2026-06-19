// parseCode/index.ts — split out of parseCode.ts (4.4).
import { ELEMENT_STATES, ROOT_ELEMENT_ID } from "../element";
import { requireAt, requireGroup } from "../safeAccess";
import { applyDeclarations, applyDeclarationsAsOverride, applyDeclarationsAsStateOverride, makeBaseline, makeRoot } from "./apply";
import { parseCssDeclarations } from "./css";
import { parseTsxStructure, parsePropsDestructure, PROP_REF_TEXT_RE } from "./tsx";
import { DEFAULT_BREAKPOINTS, DESKTOP_BREAKPOINT_ID } from "@shared/types";
/**
 * Return the set of CSS property names that appear more than once in
 * a declaration list. Used to surface a warning indicator in the
 * panel when an agent or hand edit left two `height: …` (or any
 * other property) declarations in the same block.
 *
 * Order is preserved by first appearance so callers that render the
 * list to the user get a stable order.
 */
export const findDuplicateDeclProps = (decls) => {
    const counts = new Map();
    const order = [];
    for (const { prop } of decls) {
        const seen = counts.get(prop);
        if (seen === undefined) {
            counts.set(prop, 1);
            order.push(prop);
        }
        else {
            counts.set(prop, seen + 1);
        }
    }
    return order.filter((p) => (counts.get(p) ?? 0) > 1);
};
/**
 * Detect the legacy root-sizing three-tuple and return the
 * declarations with it stripped. Only matches the exact shape the
 * pre-canvas-rework generator produced: a single `width: Npx`, a
 * single `min-height: Mpx`, and a `position: relative`, with no other
 * size-related declarations (`height`, `max-width`, etc.). Any
 * divergence means the user hand-authored something and we leave it
 * alone.
 */
const stripLegacyRootSizing = (decls) => {
    const widthIdx = decls.findIndex((d) => d.prop === 'width');
    const minHeightIdx = decls.findIndex((d) => d.prop === 'min-height');
    const positionIdx = decls.findIndex((d) => d.prop === 'position' && d.value.trim() === 'relative');
    if (widthIdx < 0 || minHeightIdx < 0 || positionIdx < 0) {
        return { decls: [...decls], migrated: false };
    }
    // Width must be a bare `<N>px` value — anything else (percentages,
    // var() references, calc()) means the user customised it.
    const widthOk = /^\s*\d+(?:\.\d+)?px\s*$/.test(requireAt(decls, widthIdx).value);
    const minHeightOk = /^\s*\d+(?:\.\d+)?px\s*$/.test(requireAt(decls, minHeightIdx).value);
    if (!widthOk || !minHeightOk) {
        return { decls: [...decls], migrated: false };
    }
    // Any additional size-related declaration means this isn't the
    // exact legacy three-tuple — don't touch it.
    const hasOtherSize = decls.some((d) => d.prop === 'height' ||
        d.prop === 'max-width' ||
        d.prop === 'max-height' ||
        d.prop === 'min-width');
    if (hasOtherSize) {
        return { decls: [...decls], migrated: false };
    }
    const stripped = decls.filter((_, i) => i !== widthIdx && i !== minHeightIdx && i !== positionIdx);
    return { decls: stripped, migrated: true };
};
/** Trailing `_<4-char-hex>` id segment of a class name (scamp's stable id). */
const CLASS_ID_SUFFIX_RE = /_([0-9a-f]{4})$/;
/** Every class name that appears anywhere in the parsed CSS. */
const collectCssClassNames = (parsed) => {
    const names = new Set();
    for (const k of parsed.byClass.keys())
        names.add(k);
    for (const k of parsed.rawByClass.keys())
        names.add(k);
    for (const k of parsed.toggledOffByClass.keys())
        names.add(k);
    for (const m of parsed.byState.values())
        for (const k of m.keys())
            names.add(k);
    for (const m of parsed.byBreakpoint.values())
        for (const k of m.keys())
            names.add(k);
    return names;
};
/**
 * Index CSS class names by their stable `_<hex>` id suffix. Ambiguous
 * suffixes (shared by two distinct class names) map to `null` so we never
 * guess. Used to recover an element whose class was renamed on only one
 * side (TSX vs CSS) — see docs/plans/2026-06-19-style-loss-on-css-edit.md.
 */
const indexCssClassesByIdSuffix = (names) => {
    const map = new Map();
    for (const name of names) {
        const m = CLASS_ID_SUFFIX_RE.exec(name);
        const id = m?.[1];
        if (id === undefined)
            continue;
        map.set(id, map.has(id) ? null : name);
    }
    return map;
};
export const parseCode = (tsx, css, options) => {
    const breakpoints = options?.breakpoints ?? DEFAULT_BREAKPOINTS;
    const rawElements = parseTsxStructure(tsx);
    const parsedCss = parseCssDeclarations(css, breakpoints);
    // Rename resilience: if a TSX className has no matching CSS class (the
    // class was renamed on only one side), fall back to the CSS class sharing
    // this element's stable 4-char hex id. Exact matches — the normal case —
    // are unaffected.
    const cssClassNames = collectCssClassNames(parsedCss);
    const classByIdSuffix = indexCssClassesByIdSuffix(cssClassNames);
    const resolveClassName = (className, id) => {
        if (className.length > 0 && cssClassNames.has(className))
            return className;
        if (id !== ROOT_ELEMENT_ID) {
            const bySuffix = classByIdSuffix.get(id);
            if (bySuffix != null)
                return bySuffix;
        }
        return className;
    };
    const elements = {};
    const cssDuplicates = {};
    // Map of `propName → defaultText` extracted from the component's
    // function destructure (empty for pages, which never emit a
    // `[Name]Props` destructure). Used in the post-pass to hydrate
    // each text element whose body resolves to `{propName}` back
    // into a typed `prop` field.
    const propDefaults = parsePropsDestructure(tsx);
    // Always start with a root, even if the TSX is missing one. Downstream
    // code (canvas store, ProjectShell) assumes ROOT_ELEMENT_ID exists.
    let rootSeen = false;
    let migrated = false;
    for (const raw of rawElements) {
        const isRoot = raw.id === ROOT_ELEMENT_ID;
        if (isRoot)
            rootSeen = true;
        // Resolve the CSS class this element's styles live under — exact match
        // normally, or the same-hex-id class if it was renamed on one side only.
        const cls = resolveClassName(raw.className, raw.id);
        const baseline = makeBaseline(raw);
        let decls = parsedCss.byClass.get(cls) ?? [];
        if (isRoot) {
            // Detect and strip the legacy three-tuple (pre-canvas-rework)
            // so the new stretch/auto defaults take over. Leaves any other
            // declarations the user wrote intact.
            const result = stripLegacyRootSizing(decls);
            decls = result.decls;
            if (result.migrated)
                migrated = true;
        }
        const applied = applyDeclarations(baseline, decls);
        // If the file didn't actually declare a width or a height for this
        // element, treat the dimension as `auto` (no rendering hint, no
        // generator output). Without this we'd silently default to the
        // 100×100 rect baseline, which makes hand-written / agent-written
        // files render at the wrong size.
        //
        // Skipped for the root: DEFAULT_ROOT_STYLES already defaults to
        // stretch/auto, so a root with no width/height decl should keep
        // those defaults rather than being forced to auto on the width axis.
        const hasWidth = decls.some((d) => d.prop === 'width');
        const hasHeight = decls.some((d) => d.prop === 'height');
        let finalElement = isRoot
            ? applied
            : {
                ...applied,
                widthMode: hasWidth ? applied.widthMode : 'auto',
                heightMode: hasHeight ? applied.heightMode : 'auto',
            };
        // Fold in any breakpoint overrides for this element's class.
        const overrides = {};
        for (const bp of breakpoints) {
            if (bp.id === DESKTOP_BREAKPOINT_ID)
                continue;
            const classesForBp = parsedCss.byBreakpoint.get(bp.id);
            if (!classesForBp)
                continue;
            const bpDecls = classesForBp.get(cls);
            if (!bpDecls || bpDecls.length === 0)
                continue;
            const override = applyDeclarationsAsOverride(bpDecls);
            if (Object.keys(override).length > 0)
                overrides[bp.id] = override;
        }
        if (Object.keys(overrides).length > 0) {
            finalElement = { ...finalElement, breakpointOverrides: overrides };
        }
        // Fold in per-state overrides for this element's class. Uses
        // `applyDeclarationsAsStateOverride` (which wraps the breakpoint
        // helper) so per-state animations parse into the typed
        // `animation` field instead of falling through to
        // customProperties.
        const stateOverrides = {};
        for (const state of ELEMENT_STATES) {
            const classesForState = parsedCss.byState.get(state);
            if (!classesForState)
                continue;
            const stateDecls = classesForState.get(cls);
            if (!stateDecls || stateDecls.length === 0)
                continue;
            const override = applyDeclarationsAsStateOverride(stateDecls);
            if (Object.keys(override).length > 0)
                stateOverrides[state] = override;
        }
        if (Object.keys(stateOverrides).length > 0) {
            finalElement = { ...finalElement, stateOverrides };
        }
        // Verbatim-preserved pseudo-class blocks for this element.
        const rawBlocks = parsedCss.rawByClass.get(cls);
        if (rawBlocks && rawBlocks.length > 0) {
            finalElement = {
                ...finalElement,
                customSelectorBlocks: rawBlocks,
            };
        }
        // Element-scoped property-group toggles. Any group labelled as
        // off in any rule (base / state / breakpoint) is treated as off
        // for the whole element — same surface the user toggles in the
        // panel. `toggledOffByClass` is already canonicalised.
        const toggledOff = parsedCss.toggledOffByClass.get(cls);
        if (toggledOff && toggledOff.length > 0) {
            finalElement = {
                ...finalElement,
                toggledOffGroups: toggledOff,
            };
        }
        elements[raw.id] = finalElement;
        // Track duplicates in the BASE class block. State / breakpoint
        // duplicates are deferred — same cleanup path applies (any panel
        // edit on the element rewrites all rule blocks for it from typed
        // state) but the indicator surface is rarer there.
        const dupes = findDuplicateDeclProps(decls);
        if (dupes.length > 0)
            cssDuplicates[raw.id] = dupes;
    }
    if (!rootSeen) {
        elements[ROOT_ELEMENT_ID] = makeRoot();
    }
    // Post-pass: hydrate component text-props. When a text element's
    // captured body is a single `{propName}` JSX expression AND the
    // function signature declared a default for that prop, set the
    // typed `prop` field and restore `text` to the destructure
    // default. Unresolved `{whatever}` expressions stay as literal
    // text so user-/agent-written JSX round-trips byte-stably.
    if (propDefaults.size > 0) {
        for (const id of Object.keys(elements)) {
            const el = elements[id];
            if (!el || el.type !== 'text')
                continue;
            const text = el.text;
            if (typeof text !== 'string')
                continue;
            const m = text.match(PROP_REF_TEXT_RE);
            if (!m)
                continue;
            const propName = requireGroup(m, 1);
            if (!propDefaults.has(propName))
                continue;
            elements[id] = {
                ...el,
                prop: propName,
                text: propDefaults.get(propName) ?? '',
            };
        }
    }
    return {
        elements,
        rootId: ROOT_ELEMENT_ID,
        customMediaBlocks: parsedCss.customMediaBlocks,
        keyframesBlocks: parsedCss.keyframesBlocks,
        cssDuplicates,
        ...(migrated ? { migrated: true } : {}),
    };
};
