import { Parser } from 'htmlparser2';
import postcss from 'postcss';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import { cssToScampProperty, isMappedProperty } from './cssPropertyMap';
import { ELEMENT_STATES, ROOT_ELEMENT_ID, } from './element';
import { parseAnimationShorthand, parsePx } from './parsers';
import { matchesPreset } from './keyframesMatch';
import { DEFAULT_BREAKPOINTS, DESKTOP_BREAKPOINT_ID, } from '@shared/types';
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
    const widthOk = /^\s*\d+(?:\.\d+)?px\s*$/.test(decls[widthIdx].value);
    const minHeightOk = /^\s*\d+(?:\.\d+)?px\s*$/.test(decls[minHeightIdx].value);
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
const CLASS_NAME_RE = /\{?\s*styles\.([A-Za-z_][A-Za-z0-9_]*)\s*\}?/;
/**
 * Tags that count as text by default. The className prefix
 * (`text_xxxx`) still wins, but if the file uses a semantic tag with a
 * non-conventional class name, we can still classify it correctly.
 */
const TEXT_TAGS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span',
    'a',
    'label',
    'strong',
    'em',
    'blockquote',
    'code',
    'small',
    'pre',
    'time',
    'figcaption',
    'legend',
    'li',
]);
const INPUT_TAGS = new Set(['input', 'textarea', 'select']);
/**
 * Decide whether an element is a text or a rectangle. The PRD's contract
 * (and `agent.md`) says the source of truth is the className prefix
 * (`rect_xxxx` vs `text_xxxx`), not the HTML tag, because hand-written
 * or agent-written files often use `<div>` for both. Fall back to the
 * tag name only when the className doesn't match the convention (e.g.
 * the special `root` class).
 */
const inferElementType = (className, tagName) => {
    if (className.startsWith('img_'))
        return 'image';
    if (className.startsWith('text_'))
        return 'text';
    if (className.startsWith('input_'))
        return 'input';
    if (className.startsWith('rect_'))
        return 'rectangle';
    if (tagName === 'img')
        return 'image';
    if (INPUT_TAGS.has(tagName))
        return 'input';
    return TEXT_TAGS.has(tagName) ? 'text' : 'rectangle';
};
/**
 * Walk the TSX with htmlparser2 and produce the element tree shape (no
 * styles yet — those come from the CSS pass). We rely on the strict format
 * generateCode emits, so we don't need a real JSX parser:
 *
 *   <div data-scamp-id="..." className={styles.X}>...</div>
 *   <p   data-scamp-id="..." className={styles.X}>text</p>
 *
 * Special cases:
 *   - `<svg>` inner source is captured verbatim via the parser's
 *     start/end indices; nested open/close events inside the svg are
 *     suppressed so children of the svg don't become canvas elements.
 *   - `<select>` children named `<option>` are consumed into a typed
 *     `selectOptions` list on the select rather than treated as canvas
 *     elements in their own right.
 */
const parseTsxStructure = (tsx) => {
    const elements = [];
    const stack = [];
    const byId = new Map();
    const frames = [];
    // Depth of nested unclassed (skipped) tags currently open inside
    // a Scamp parent. When > 0, we treat text + nested tags as part of
    // the verbatim JSX fragment — only capture once we close the
    // OUTERMOST skipped tag so e.g. `<strong>a <em>b</em></strong>`
    // round-trips byte-equivalent.
    let skippedDepth = 0;
    let skippedRootStart = 0;
    // When capturing an svg's verbatim inner source.
    let svgTarget = null;
    let svgInnerStart = 0;
    // When inside a `<select>` element, we collect its `<option>`
    // children into the typed list rather than as normal RawElements.
    let selectTarget = null;
    let currentOption = null;
    const parser = new Parser({
        onopentag(name, attribs) {
            // Already inside an svg — everything is raw inner source.
            if (svgTarget) {
                frames.push('svg-inner');
                return;
            }
            // Inside a select: recognise option children, ignore other tags.
            if (selectTarget && name === 'option') {
                currentOption = {
                    value: attribs['value'] ?? '',
                    label: '',
                    selected: 'selected' in attribs,
                };
                frames.push('option');
                return;
            }
            const rawId = attribs['data-scamp-id'];
            if (typeof rawId !== 'string' || rawId.length === 0) {
                // Unclassed JSX inside a Scamp parent — start capturing
                // verbatim source from the outermost skipped tag's open
                // bracket so the close handler can slice the full subtree
                // and push it as an `inlineFragments` entry on the parent.
                if (skippedDepth === 0 && stack.length > 0) {
                    skippedRootStart = parser.startIndex ?? 0;
                }
                skippedDepth += 1;
                frames.push('skipped');
                return;
            }
            // data-scamp-id is either the full class name (`sidebar_a1b2`,
            // `rect_a1b2`) or, for backward compat with older projects, the
            // short 4-char hex id (`a1b2`). Extract the short id in both cases.
            const id = rawId === ROOT_ELEMENT_ID
                ? ROOT_ELEMENT_ID
                : rawId.includes('_')
                    ? rawId.slice(rawId.lastIndexOf('_') + 1)
                    : rawId;
            // className attribute case is preserved by the parser options —
            // fall back to the lowercase form too in case a hand-written
            // file uses HTML-style `class`.
            const classRaw = attribs['className'] ?? attribs['classname'] ?? '';
            const match = classRaw.match(CLASS_NAME_RE);
            const className = match?.[1] ?? '';
            const type = inferElementType(className, name);
            const parentId = stack.length > 0 ? stack[stack.length - 1].id : null;
            // Derive the custom name from the class name prefix. If the
            // prefix is one of the defaults, the element has no custom name.
            let parsedName = null;
            if (className.includes('_') && rawId !== ROOT_ELEMENT_ID) {
                const prefix = className.slice(0, className.lastIndexOf('_'));
                if (prefix !== 'rect' &&
                    prefix !== 'text' &&
                    prefix !== 'img' &&
                    prefix !== 'input') {
                    parsedName = prefix;
                }
            }
            // Typed src/alt only apply when the tag is actually `<img>` —
            // video/iframe/svg and other image-family tags carry their
            // tag-specific attributes through the generic bag.
            const typedImgSrcAlt = type === 'image' && name === 'img';
            // Collect every attribute not already typed-captured into the
            // generic bag. Preserves unknown attrs verbatim.
            const extraAttributes = {};
            for (const [attrName, attrValue] of Object.entries(attribs)) {
                if (attrName === 'data-scamp-id')
                    continue;
                if (attrName === 'className' || attrName === 'classname')
                    continue;
                if (typedImgSrcAlt && (attrName === 'src' || attrName === 'alt'))
                    continue;
                extraAttributes[attrName] = attrValue;
            }
            const el = {
                id,
                type,
                tag: name,
                className,
                parentId,
                childIds: [],
                text: null,
                inlineFragments: [],
                name: parsedName,
                src: typedImgSrcAlt ? (attribs['src'] ?? null) : null,
                alt: typedImgSrcAlt ? (attribs['alt'] ?? null) : null,
                attributes: extraAttributes,
                svgSource: null,
                selectOptions: null,
            };
            if (parentId) {
                const parent = byId.get(parentId);
                parent?.childIds.push(id);
            }
            elements.push(el);
            byId.set(id, el);
            stack.push(el);
            frames.push('pushed');
            // After registering the element, check whether it kicks off
            // one of the special-case capture modes.
            if (name === 'svg') {
                svgTarget = el;
                // htmlparser2's endIndex is the `>` of the opening tag; the
                // verbatim body starts one character later.
                svgInnerStart = (parser.endIndex ?? 0) + 1;
            }
            else if (name === 'select') {
                selectTarget = el;
                el.selectOptions = [];
            }
        },
        ontext(text) {
            if (svgTarget)
                return; // inner source captured wholesale on close
            if (currentOption) {
                currentOption.label += text;
                return;
            }
            // Inside an unclassed JSX subtree — text is part of the
            // verbatim source captured on close.
            if (skippedDepth > 0)
                return;
            const top = stack[stack.length - 1];
            if (!top)
                return;
            if (top.type === 'text') {
                // Text element — concatenate raw chunks; htmlparser2 may
                // emit multiple ontext events around an entity boundary.
                top.text = (top.text ?? '') + text;
                return;
            }
            // Loose text inside a non-text Scamp parent — preserve as a
            // fragment so the source order is recoverable. Drop pure-
            // whitespace chunks (newline + indent between tags) to avoid
            // double-spacing the generator's own indentation on emit.
            if (text.trim().length === 0)
                return;
            top.inlineFragments.push({
                kind: 'text',
                value: text,
                afterChildIndex: top.childIds.length - 1,
            });
        },
        onclosetag(name) {
            const frame = frames.pop();
            if (frame === 'svg-inner')
                return;
            if (frame === 'option') {
                if (!currentOption)
                    return;
                const label = currentOption.label.trim();
                const entry = {
                    value: currentOption.value,
                    label,
                };
                if (currentOption.selected)
                    entry.selected = true;
                if (selectTarget?.selectOptions) {
                    selectTarget.selectOptions.push(entry);
                }
                currentOption = null;
                return;
            }
            if (frame === 'skipped') {
                skippedDepth -= 1;
                // Just closed the OUTERMOST skipped tag inside a Scamp
                // parent — slice its verbatim source out of the original
                // tsx and push as an inline JSX fragment on that parent.
                if (skippedDepth === 0 && stack.length > 0) {
                    const closeEnd = (parser.endIndex ?? skippedRootStart) + 1;
                    const source = tsx.slice(skippedRootStart, closeEnd);
                    const top = stack[stack.length - 1];
                    top.inlineFragments.push({
                        kind: 'jsx',
                        source,
                        afterChildIndex: top.childIds.length - 1,
                    });
                }
                return;
            }
            // 'pushed' — real element. Pop the stack; also clear
            // svg/select capture state if this is the element that opened
            // them.
            const top = stack.pop();
            if (top && top === svgTarget) {
                const closeAt = parser.startIndex ?? tsx.length;
                const source = tsx.slice(svgInnerStart, closeAt);
                // Empty source (self-closing `<svg />` or `<svg></svg>`)
                // stays as null so round-trips re-emit the self-closing
                // form instead of growing an open+close pair.
                top.svgSource = source.length > 0 ? source : null;
                svgTarget = null;
            }
            if (top && top === selectTarget) {
                selectTarget = null;
            }
            // `name` is intentionally unread — htmlparser2 calls
            // onclosetag in nesting order so the pop above matches.
            void name;
        },
    }, {
        lowerCaseTags: true,
        // Preserve attribute case so React-idiomatic attributes like
        // `htmlFor` and `tabIndex` round-trip unchanged.
        lowerCaseAttributeNames: false,
        decodeEntities: true,
        // Generated TSX uses self-closing syntax for empty elements
        // (`<div />`). div isn't a void element in HTML so we have to
        // opt in here.
        recognizeSelfClosing: true,
    });
    parser.write(tsx);
    parser.end();
    return elements;
};
const SUPPORTED_STATES = new Map(ELEMENT_STATES.map((s) => [`:${s}`, s]));
const classifyClassSelector = (selector) => {
    if (!selector.startsWith('.'))
        return null;
    // Capture the leading class name (CSS identifier, allowing `_`,
    // `-`, digits after the first char). Anything after is `rest`.
    const match = selector.match(/^\.([A-Za-z_][\w-]*)([\s\S]*)$/);
    if (!match)
        return null;
    const className = match[1] ?? '';
    const rest = (match[2] ?? '').trim();
    if (rest.length === 0)
        return { kind: 'base', className };
    const stateMatch = SUPPORTED_STATES.get(rest);
    if (stateMatch !== undefined) {
        return { kind: 'state', className, state: stateMatch };
    }
    return { kind: 'raw', className };
};
/** Extract a numeric max-width from a media query condition like
 *  `(max-width: 768px)`. Returns null for anything else so we don't
 *  silently mis-route min-width, orientation, or complex queries. */
const parseMaxWidthParam = (params) => {
    const match = params
        .trim()
        .match(/^\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/);
    if (!match)
        return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
};
/**
 * Parse a CSS module file into class-keyed declarations plus any
 * `@media` declarations the parser can route to a known breakpoint.
 * Unrecognised @media blocks are preserved verbatim so the generator
 * can re-emit them untouched on round-trip.
 */
const parseCssDeclarations = (css, breakpoints) => {
    const byClass = new Map();
    const byBreakpoint = new Map();
    const byState = new Map();
    const rawByClass = new Map();
    const customMediaBlocks = [];
    const keyframesBlocks = [];
    let root;
    try {
        root = postcss.parse(css);
    }
    catch {
        return {
            byClass,
            byBreakpoint,
            byState,
            rawByClass,
            customMediaBlocks,
            keyframesBlocks,
        };
    }
    // Walk top-level rules first — these are the base class blocks
    // and per-state pseudo-class blocks. Using direct iteration (not
    // walkRules) so we skip rules nested inside @media; those get
    // handled in the at-rule walk below.
    for (const node of root.nodes) {
        if (node.type !== 'rule')
            continue;
        const selector = node.selector.trim();
        const classification = classifyClassSelector(selector);
        if (classification === null)
            continue;
        if (classification.kind === 'raw') {
            // Preserve verbatim. Format the body as a single string —
            // postcss's `raws` give us original whitespace and comments.
            const decls = node.nodes
                .map((child) => child.toString().trim())
                .filter((s) => s.length > 0)
                .map((s) => `  ${s}`)
                .join('\n');
            const list = rawByClass.get(classification.className) ?? [];
            list.push({ selector, body: decls });
            rawByClass.set(classification.className, list);
            continue;
        }
        const decls = [];
        node.walkDecls((decl) => {
            decls.push({ prop: decl.prop, value: decl.value });
        });
        if (classification.kind === 'base') {
            byClass.set(classification.className, decls);
        }
        else {
            // state
            const bucket = byState.get(classification.state) ?? new Map();
            bucket.set(classification.className, decls);
            byState.set(classification.state, bucket);
        }
    }
    // Walk top-level @media at-rules. Route known (max-width: Npx)
    // queries into the breakpoint bucket; stash everything else as
    // raw CSS for verbatim re-emit.
    const widthToId = new Map();
    for (const bp of breakpoints) {
        if (bp.id === DESKTOP_BREAKPOINT_ID)
            continue;
        widthToId.set(bp.width, bp.id);
    }
    for (const node of root.nodes) {
        if (node.type !== 'atrule')
            continue;
        if (node.name === 'keyframes') {
            // Capture verbatim body (everything between the outer braces),
            // mark `isPreset` based on structural equivalence to the
            // canonical preset body if the name matches.
            const name = node.params.trim();
            const body = (node.nodes ?? [])
                .map((child) => child.toString())
                .join('\n');
            keyframesBlocks.push({
                name,
                body,
                isPreset: matchesPreset(name, body),
            });
            continue;
        }
        if (node.name !== 'media') {
            // Vendor-prefixed keyframes (`-webkit-keyframes`,
            // `-moz-keyframes`, etc.) and any other unrecognised at-rule
            // round-trip verbatim via customMediaBlocks (a slight misnomer
            // — it's the catch-all bucket for at-rules we don't model).
            customMediaBlocks.push(node.toString());
            continue;
        }
        const maxWidth = parseMaxWidthParam(node.params);
        const bpId = maxWidth !== null ? widthToId.get(maxWidth) : undefined;
        if (!bpId) {
            customMediaBlocks.push(node.toString());
            continue;
        }
        // State × breakpoint combinations are out of scope (see element-
        // states plan). If any rule inside the @media isn't a plain base
        // class rule (e.g. `.foo:hover` inside @media), preserve the
        // whole block verbatim instead of risking a partial / wrong
        // routing — round-trip stays text-stable.
        //
        // Same defence for `animation` declarations: per-breakpoint
        // animations aren't typed, so a `@media { .foo { animation: ... } }`
        // block routes verbatim to customMediaBlocks rather than risk an
        // animation field landing in `breakpointOverrides` (the type
        // doesn't allow it).
        let hasNonBaseRule = false;
        let hasAnimationDecl = false;
        node.walkRules((rule) => {
            const c = classifyClassSelector(rule.selector.trim());
            if (c === null)
                return;
            if (c.kind !== 'base')
                hasNonBaseRule = true;
            rule.walkDecls((decl) => {
                if (decl.prop === 'animation')
                    hasAnimationDecl = true;
            });
        });
        if (hasNonBaseRule || hasAnimationDecl) {
            customMediaBlocks.push(node.toString());
            continue;
        }
        // Extract per-class declarations inside this @media.
        const bucket = byBreakpoint.get(bpId) ?? new Map();
        node.walkRules((rule) => {
            const c = classifyClassSelector(rule.selector.trim());
            if (c === null || c.kind !== 'base')
                return;
            const decls = [];
            rule.walkDecls((decl) => {
                decls.push({ prop: decl.prop, value: decl.value });
            });
            bucket.set(c.className, decls);
        });
        byBreakpoint.set(bpId, bucket);
    }
    return {
        byClass,
        byBreakpoint,
        byState,
        rawByClass,
        customMediaBlocks,
        keyframesBlocks,
    };
};
/**
 * Apply a list of declarations as a breakpoint override. Unlike
 * `applyDeclarations` (which overlays onto a full element baseline
 * and returns a full element), this returns a Partial carrying just
 * the fields the declarations touch — the right shape for
 * `element.breakpointOverrides[bpId]`.
 */
const applyDeclarationsAsOverride = (decls) => {
    let override = {};
    const customProperties = {};
    for (const { prop, value } of decls) {
        // `position` is now a typed field — fall through to the
        // cssPropertyMap mapper below.
        if (prop === 'left') {
            override = { ...override, x: parsePx(value) };
            continue;
        }
        if (prop === 'top') {
            override = { ...override, y: parsePx(value) };
            continue;
        }
        if (prop === 'margin-top') {
            const m = override.margin ?? [0, 0, 0, 0];
            override = { ...override, margin: [parsePx(value), m[1], m[2], m[3]] };
            continue;
        }
        if (prop === 'margin-right') {
            const m = override.margin ?? [0, 0, 0, 0];
            override = { ...override, margin: [m[0], parsePx(value), m[2], m[3]] };
            continue;
        }
        if (prop === 'margin-bottom') {
            const m = override.margin ?? [0, 0, 0, 0];
            override = { ...override, margin: [m[0], m[1], parsePx(value), m[3]] };
            continue;
        }
        if (prop === 'margin-left') {
            const m = override.margin ?? [0, 0, 0, 0];
            override = { ...override, margin: [m[0], m[1], m[2], parsePx(value)] };
            continue;
        }
        if (isMappedProperty(prop)) {
            const mapper = cssToScampProperty[prop];
            const delta = mapper(value);
            // Refusable mappers return `null` to mean "I can't reduce this
            // value to a typed field — preserve the raw declaration via
            // customProperties". Anything else (`{}` or a real delta) is
            // applied to the typed override.
            if (delta === null) {
                customProperties[prop] = value;
                continue;
            }
            override = { ...override, ...delta };
            continue;
        }
        customProperties[prop] = value;
    }
    if (Object.keys(customProperties).length > 0) {
        override = { ...override, customProperties };
    }
    return override;
};
/**
 * Like `applyDeclarationsAsOverride` but also parses the `animation`
 * shorthand into the typed `StateOverride.animation` field. Used for
 * pseudo-class state blocks (`:hover`, `:active`, `:focus`) where
 * per-state animations are supported.
 *
 * Multi-animation source (commas at the top level) round-trips via
 * `customProperties.animation` exactly like the base path — the
 * picker doesn't model the multi case but the value is preserved.
 */
const applyDeclarationsAsStateOverride = (decls) => {
    const base = applyDeclarationsAsOverride(decls);
    const animDecl = decls.find((d) => d.prop === 'animation');
    if (!animDecl)
        return base;
    const parsed = parseAnimationShorthand(animDecl.value);
    if (parsed === null) {
        // Multi-animation or unparseable — leave it in customProperties
        // where the breakpoint helper put it. No typed field set.
        return base;
    }
    // Move animation from customProperties (where the breakpoint helper
    // stored it as an unmapped property) into the typed field, so the
    // generator emits one declaration not two.
    const cleanedCustom = { ...(base.customProperties ?? {}) };
    delete cleanedCustom.animation;
    const out = { ...base, animation: parsed };
    if (Object.keys(cleanedCustom).length > 0) {
        out.customProperties = cleanedCustom;
    }
    else {
        delete out.customProperties;
    }
    return out;
};
const makeRoot = () => ({
    ...DEFAULT_ROOT_STYLES,
    id: ROOT_ELEMENT_ID,
    type: 'rectangle',
    parentId: null,
    childIds: [],
    x: 0,
    y: 0,
    customProperties: {},
    inlineFragments: [],
});
/** The HTML tag we'd default to for an element of this type. Used to
 *  decide whether the parsed `tag` is the default (and can be omitted)
 *  or a deliberate semantic override (and should be stored). */
const defaultTagForType = (type) => {
    if (type === 'image')
        return 'img';
    if (type === 'input')
        return 'input';
    return type === 'text' ? 'p' : 'div';
};
const makeBaseline = (raw) => {
    const isRoot = raw.id === ROOT_ELEMENT_ID;
    // Root has its own default shape (100% stretch / auto height / white
    // page background); every other element starts from rect defaults.
    const defaults = isRoot ? DEFAULT_ROOT_STYLES : DEFAULT_RECT_STYLES;
    return {
        ...defaults,
        id: raw.id,
        type: raw.type,
        parentId: raw.parentId,
        childIds: [...raw.childIds],
        x: 0,
        y: 0,
        customProperties: {},
        inlineFragments: [...raw.inlineFragments],
        ...(raw.type === 'text' && raw.text !== null ? { text: raw.text.trim() } : {}),
        // Only store an explicit tag when it's NOT the type's default. Keeps
        // the round-trip text-stable: a `<div>` rectangle parses with no
        // `tag` field and the generator emits a `<div>` again.
        ...(raw.tag !== defaultTagForType(raw.type) ? { tag: raw.tag } : {}),
        ...(raw.name !== null ? { name: raw.name } : {}),
        ...(raw.src !== null ? { src: raw.src } : {}),
        ...(raw.alt !== null ? { alt: raw.alt } : {}),
        // Only store the attribute bag when non-empty so round-trips stay
        // text-stable: an element with no extra attrs parses with no
        // `attributes` field.
        ...(Object.keys(raw.attributes).length > 0 ? { attributes: raw.attributes } : {}),
        ...(raw.svgSource !== null ? { svgSource: raw.svgSource } : {}),
        ...(raw.selectOptions !== null ? { selectOptions: raw.selectOptions } : {}),
    };
};
/**
 * Apply a list of declarations to an element. Returns a new element with
 * mapped properties applied and unmapped ones stored verbatim in
 * customProperties.
 *
 * Position properties (`position`, `left`, `top`) are handled inline since
 * they affect element fields that aren't in cssToScampProperty.
 */
const applyDeclarations = (baseline, decls) => {
    let element = baseline;
    const customProperties = {};
    for (const { prop, value } of decls) {
        // `position` is a typed field handled by the cssPropertyMap below
        // — drop straight through. The legacy "skip position entirely"
        // behavior dropped agent-written `position: fixed` etc., which
        // is the bug we're fixing.
        if (prop === 'left') {
            element = { ...element, x: parsePx(value) };
            continue;
        }
        if (prop === 'top') {
            element = { ...element, y: parsePx(value) };
            continue;
        }
        // Per-side margin longhands write into a single tuple slot. Handled
        // inline because mapper deltas can't express tuple updates.
        if (prop === 'margin-top') {
            const m = element.margin;
            element = { ...element, margin: [parsePx(value), m[1], m[2], m[3]] };
            continue;
        }
        if (prop === 'margin-right') {
            const m = element.margin;
            element = { ...element, margin: [m[0], parsePx(value), m[2], m[3]] };
            continue;
        }
        if (prop === 'margin-bottom') {
            const m = element.margin;
            element = { ...element, margin: [m[0], m[1], parsePx(value), m[3]] };
            continue;
        }
        if (prop === 'margin-left') {
            const m = element.margin;
            element = { ...element, margin: [m[0], m[1], m[2], parsePx(value)] };
            continue;
        }
        // Animation is parsed into a typed field on the element. The
        // shorthand parser returns null on multi-animation source
        // (commas at the top level) — those round-trip verbatim via
        // customProperties so the agent's intent is preserved.
        if (prop === 'animation') {
            const parsed = parseAnimationShorthand(value);
            if (parsed === null) {
                customProperties[prop] = value;
                continue;
            }
            element = { ...element, animation: parsed };
            continue;
        }
        if (isMappedProperty(prop)) {
            // `position` has a special "auto" sentinel meaning "let
            // Scamp's tree-shape rules pick the value". When the file
            // contains exactly the value Scamp would have auto-emitted, we
            // skip pinning so the typed field stays `'auto'` and round-
            // trips text-stable.
            if (prop === 'position') {
                const v = value.trim();
                if (v === 'absolute')
                    continue;
                if (v === 'relative' && element.id === ROOT_ELEMENT_ID)
                    continue;
            }
            const mapper = cssToScampProperty[prop];
            const delta = mapper(value);
            if (delta === null) {
                customProperties[prop] = value;
                continue;
            }
            element = { ...element, ...delta };
            continue;
        }
        customProperties[prop] = value;
    }
    return { ...element, customProperties };
};
export const parseCode = (tsx, css, options) => {
    const breakpoints = options?.breakpoints ?? DEFAULT_BREAKPOINTS;
    const rawElements = parseTsxStructure(tsx);
    const parsedCss = parseCssDeclarations(css, breakpoints);
    const elements = {};
    // Always start with a root, even if the TSX is missing one. Downstream
    // code (canvas store, ProjectShell) assumes ROOT_ELEMENT_ID exists.
    let rootSeen = false;
    let migrated = false;
    for (const raw of rawElements) {
        const isRoot = raw.id === ROOT_ELEMENT_ID;
        if (isRoot)
            rootSeen = true;
        const baseline = makeBaseline(raw);
        let decls = parsedCss.byClass.get(raw.className) ?? [];
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
            const bpDecls = classesForBp.get(raw.className);
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
            const stateDecls = classesForState.get(raw.className);
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
        const rawBlocks = parsedCss.rawByClass.get(raw.className);
        if (rawBlocks && rawBlocks.length > 0) {
            finalElement = {
                ...finalElement,
                customSelectorBlocks: rawBlocks,
            };
        }
        elements[raw.id] = finalElement;
    }
    if (!rootSeen) {
        elements[ROOT_ELEMENT_ID] = makeRoot();
    }
    return {
        elements,
        rootId: ROOT_ELEMENT_ID,
        customMediaBlocks: parsedCss.customMediaBlocks,
        keyframesBlocks: parsedCss.keyframesBlocks,
        ...(migrated ? { migrated: true } : {}),
    };
};
