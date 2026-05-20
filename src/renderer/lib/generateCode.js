import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import { getTagDefaultPadding, paddingEquals } from './tagDefaults';
import { ELEMENT_STATES, ROOT_ELEMENT_ID, slugifyName, } from './element';
import { formatAnimationShorthand, formatBoxShadowShorthand, formatFilterList, formatTransitionShorthand, } from './parsers';
import { CUSTOM_PROP_TO_GROUP } from './propertyGroups';
import { DESKTOP_BREAKPOINT_ID, } from '@shared/types';
const escapeHtml = (raw) => raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const componentNameFromPage = (pageName) => {
    const parts = pageName.split(/[-_]/).filter((part) => part.length > 0);
    if (parts.length === 0)
        return 'Page';
    return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};
/**
 * The CSS class name for an element. When the element has a custom name,
 * the slugified name replaces the type prefix:
 *   - unnamed rect → `rect_a1b2`
 *   - named "Hero Card" → `hero-card_a1b2`
 *   - root → `root` (always)
 */
export const classNameFor = (el) => {
    if (el.id === ROOT_ELEMENT_ID)
        return 'root';
    // Component instances don't own a CSS class. Their identity on
    // the page is `data-scamp-instance-id` ("inst_a1b2"), so we
    // return that here — it's the only thing the layers tooltip /
    // element-class data-attr would want to surface for an
    // instance anyway.
    if (el.type === 'component-instance') {
        return el.instanceId ?? `inst_${el.id}`;
    }
    const prefix = el.name ? slugifyName(el.name) : '';
    const defaultPrefix = el.type === 'image'
        ? 'img'
        : el.type === 'input'
            ? 'input'
            : el.type === 'rectangle'
                ? 'rect'
                : 'text';
    return `${prefix.length > 0 ? prefix : defaultPrefix}_${el.id}`;
};
const indent = (level) => '  '.repeat(level);
/** The HTML tag we'd use by default for an element of this type. */
const defaultTagFor = (el) => {
    if (el.id === ROOT_ELEMENT_ID)
        return 'div';
    if (el.type === 'image')
        return 'img';
    if (el.type === 'input')
        return 'input';
    if (el.type === 'component-instance') {
        // PascalCase component name. Falls back to `div` when the
        // field is missing — defensive, shouldn't happen in practice
        // because the parser always populates it.
        return el.componentName ?? 'div';
    }
    return el.type === 'text' ? 'p' : 'div';
};
/** The actual tag to emit / render — explicit override wins over the default. */
export const tagFor = (el) => {
    // Component instances aren't tag-overridable from the panel — the
    // JSX tag IS the component identity. Ignore any stray `tag` on
    // those elements.
    if (el.type === 'component-instance')
        return defaultTagFor(el);
    return el.tag ?? defaultTagFor(el);
};
/**
 * HTML tags rendered as void / self-closing in our output. Covers the
 * HTML5 void-element set plus the cases we care about in the generator
 * (img / input are the common ones). Textarea and select are NOT void
 * even when empty.
 */
const VOID_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'source',
    'track',
    'wbr',
]);
/**
 * Format one bag entry as a JSX attribute. Boolean-style entries stored
 * as the empty string (`""`) emit bare (`controls`); everything else is
 * double-quoted with HTML-escaped value. Attribute name is emitted
 * verbatim so user-written React-style casing (`htmlFor`,
 * `tabIndex`, …) round-trips unchanged.
 */
const formatAttribute = (name, value) => {
    if (value === '')
        return name;
    return `${name}="${escapeHtml(value)}"`;
};
/**
 * Render the `<option>` children of a `<select>` element. Each option
 * is emitted on its own line, indented one level past the select.
 * Boolean `selected` follows the same empty-string convention as other
 * boolean attributes.
 */
const renderSelectOptions = (options, level) => options
    .map((opt) => {
    const attrs = [`value="${escapeHtml(opt.value)}"`];
    if (opt.selected)
        attrs.push('selected');
    return `${indent(level)}<option ${attrs.join(' ')}>${escapeHtml(opt.label)}</option>`;
})
    .join('\n');
/**
 * Render a single element + its descendants as a JSX subtree.
 * Self-closes when the element has no children and (for text elements)
 * no text content.
 */
const renderJsx = (el, elements, level, isComponent) => {
    // Component instances render as their own PascalCase JSX tag,
    // self-closing, carrying `data-scamp-instance-id` + one
    // attribute per prop override. They never have classNames, page
    // children, or text — the visible content lives inside the
    // component definition's own files. The matching `import` is
    // emitted at the top of the page TSX by `collectComponentImports`.
    if (el.type === 'component-instance') {
        const tagName = el.componentName ?? 'Unknown';
        const attrs = [
            `data-scamp-instance-id="${escapeHtml(el.instanceId ?? '')}"`,
        ];
        const overrides = el.propOverrides ?? {};
        for (const [propName, value] of Object.entries(overrides)) {
            attrs.push(`${propName}="${escapeHtml(value)}"`);
        }
        return `${indent(level)}<${tagName} ${attrs.join(' ')} />`;
    }
    const className = classNameFor(el);
    const tag = tagFor(el);
    // Baseline attributes every element carries. Typed `src` / `alt`
    // only apply to actual `<img>` — other image-family tags (video,
    // iframe, svg) carry their own attribute sets via the generic bag
    // because `alt` is invalid on them and `src` has tag-specific
    // semantics.
    const baseAttrs = [
        `data-scamp-id="${className}"`,
        `className={styles.${className}}`,
    ];
    if (el.type === 'image' && tag === 'img') {
        baseAttrs.push(`src="${escapeHtml(el.src ?? '')}"`);
        baseAttrs.push(`alt="${escapeHtml(el.alt ?? '')}"`);
    }
    // Generic attribute bag. Iteration order matches insertion order so
    // round-trips stay text-stable.
    if (el.attributes) {
        for (const [name, value] of Object.entries(el.attributes)) {
            baseAttrs.push(formatAttribute(name, value));
        }
    }
    const open = `<${tag} ${baseAttrs.join(' ')}`;
    // Self-closing void tags (img, input, br, …). No children, no text,
    // no inner source possible.
    if (VOID_TAGS.has(tag)) {
        return `${indent(level)}${open} />`;
    }
    // SVG gets the verbatim inner source. No padding newlines around it
    // — whatever the user stored is what lands on disk, so the parser
    // can slice the same bytes back into `svgSource` on round-trip.
    if (tag === 'svg') {
        const source = el.svgSource ?? '';
        if (source.length === 0) {
            return `${indent(level)}${open} />`;
        }
        return `${indent(level)}${open}>${source}</${tag}>`;
    }
    // Select: emit options as inline children regardless of childIds.
    if (tag === 'select') {
        const options = el.selectOptions ?? [];
        if (options.length === 0) {
            return `${indent(level)}${open} />`;
        }
        const optionLines = renderSelectOptions(options, level + 1);
        return `${indent(level)}${open}>\n${optionLines}\n${indent(level)}</${tag}>`;
    }
    // Components emit `{propName}` for text elements whose `prop` is
    // set — the literal value moves to the function-signature default.
    // Pages render the literal directly because the prop concept
    // doesn't exist there.
    const propRef = el.type === 'text' && isComponent && el.prop !== undefined && el.prop.length > 0
        ? el.prop
        : null;
    const hasText = propRef !== null ||
        (el.type === 'text' && typeof el.text === 'string' && el.text.length > 0);
    const hasChildren = el.childIds.length > 0;
    const fragments = el.inlineFragments;
    const hasFragments = fragments.length > 0;
    if (!hasChildren && !hasText && !hasFragments) {
        return `${indent(level)}${open} />`;
    }
    if (hasText && !hasChildren && !hasFragments) {
        const body = propRef !== null ? `{${propRef}}` : escapeHtml(el.text ?? '');
        return `${indent(level)}${open}>${body}</${tag}>`;
    }
    // Emit fragments before any element child, interleaved between
    // children, and after the last child — using each fragment's
    // `afterChildIndex`. Text fragments are escaped; JSX fragments are
    // emitted byte-for-byte from the captured source.
    const fragmentsAt = (idx) => fragments
        .filter((f) => f.afterChildIndex === idx)
        .map((f) => {
        const text = f.kind === 'text' ? escapeHtml(f.value) : f.source;
        return `${indent(level + 1)}${text}`;
    })
        .join('\n');
    const segments = [];
    if (hasText) {
        const body = propRef !== null ? `{${propRef}}` : escapeHtml(el.text ?? '');
        segments.push(`${indent(level + 1)}${body}`);
    }
    const before = fragmentsAt(-1);
    if (before.length > 0)
        segments.push(before);
    el.childIds.forEach((childId, i) => {
        const child = elements[childId];
        if (child) {
            const line = renderJsx(child, elements, level + 1, isComponent);
            if (line.length > 0)
                segments.push(line);
        }
        const after = fragmentsAt(i);
        if (after.length > 0)
            segments.push(after);
    });
    const inner = segments.join('\n');
    return `${indent(level)}${open}>\n${inner}\n${indent(level)}</${tag}>`;
};
/**
 * Walk every element in the page and collect the PascalCase
 * component names used by any `component-instance` element.
 * Deduped + sorted alphabetically so the generated import block
 * is stable across saves regardless of element insertion order.
 *
 * Missing-component instances (the parser couldn't resolve them
 * to a real component on disk) are deliberately INCLUDED here:
 * the original page TSX referenced them by name, and Scamp's
 * canonical output should keep that name visible to the user /
 * agent so the broken reference is obvious in the file.
 */
const collectComponentImports = (elements) => {
    const names = new Set();
    for (const el of Object.values(elements)) {
        if (el.type !== 'component-instance')
            continue;
        const name = el.componentName;
        if (name && name.length > 0)
            names.add(name);
    }
    return [...names].sort();
};
/**
 * Walk the element tree from `rootId` collecting every text
 * descendant with a `prop` set. Returns one entry per unique prop
 * name in document order (depth-first), with the originating text
 * element's `text` as the default value. Multiple text elements
 * with the same prop name share one declaration — first one wins
 * for the default. The Data tab validates uniqueness on input so
 * this collision shouldn't happen in practice; this is just a
 * defensive guarantee against malformed states surviving an edit.
 */
const collectTextProps = (elements, rootId) => {
    const seen = new Set();
    const out = [];
    const walk = (id) => {
        const el = elements[id];
        if (!el)
            return;
        if (el.type === 'text' &&
            typeof el.prop === 'string' &&
            el.prop.length > 0 &&
            !seen.has(el.prop)) {
            seen.add(el.prop);
            out.push({ name: el.prop, defaultText: el.text ?? '' });
        }
        for (const childId of el.childIds)
            walk(childId);
    };
    walk(rootId);
    return out;
};
/**
 * Format one string for a TypeScript default-value position
 * (function destructure). We use double-quoted form and escape
 * the minimal characters that would break it. Multi-line text is
 * collapsed onto one line as the JS string-literal `\n` form so
 * the destructure stays on a single line and parses cleanly.
 */
const tsStringLiteral = (raw) => {
    const escaped = raw
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
    return `"${escaped}"`;
};
const generateTsx = (elements, rootId, pageName, cssModuleImportName, isComponent) => {
    const root = elements[rootId];
    const componentName = componentNameFromPage(pageName);
    const stylesImport = `import styles from './${cssModuleImportName}.module.css';`;
    // Component imports follow the styles import, one per
    // referenced component. The path uses the `@/` alias so the
    // resolution works both inside Scamp's canvas iframe and in a
    // user's `next dev` run.
    const componentImports = collectComponentImports(elements).map((name) => `import ${name} from '@/components/${name}/${name}';`);
    const importLines = [stylesImport, ...componentImports].join('\n');
    // Props emission (component-only). When the component has at
    // least one text-prop, emit `type [Name]Props = { … }` before
    // the function and destructure with defaults in the signature.
    // No props or page → use the existing no-args signature.
    const textProps = isComponent ? collectTextProps(elements, rootId) : [];
    const hasProps = textProps.length > 0;
    const propsTypeName = `${componentName}Props`;
    const propsTypeBlock = hasProps
        ? `type ${propsTypeName} = {\n${textProps
            .map((p) => `  ${p.name}?: string;`)
            .join('\n')}\n};\n\n`
        : '';
    const signatureArgs = hasProps
        ? `{ ${textProps
            .map((p) => `${p.name} = ${tsStringLiteral(p.defaultText)}`)
            .join(', ')} }: ${propsTypeName}`
        : '';
    if (!root) {
        return `${importLines}\n\n${propsTypeBlock}export default function ${componentName}(${signatureArgs}) {\n  return null;\n}\n`;
    }
    const body = renderJsx(root, elements, 2, isComponent);
    return `${importLines}\n\n${propsTypeBlock}export default function ${componentName}(${signatureArgs}) {\n  return (\n${body}\n  );\n}\n`;
};
/**
 * Build the list of `prop: value;` lines for one element. Skips anything
 * equal to its default; appends customProperties verbatim at the end.
 *
 * Exported so the properties panel can render what would be written to
 * disk for the selected element without having to re-implement the rules.
 */
export const elementDeclarationLines = (el, parent) => {
    const lines = [];
    // Buffer for declarations routed into toggled-off group comment
    // blocks. Keyed by group; values are the already-`/* … */`-wrapped
    // commented decls in emit order. Drained at the end of the
    // function as `/* group off */` blocks appended after the
    // active lines.
    const commentedByGroup = new Map();
    const offGroups = new Set(el.toggledOffGroups);
    /**
     * Route a `prop: value;` line either to the active lines buffer
     * or to the appropriate group's comment buffer. `group === null`
     * means the property isn't part of a togglable group and always
     * emits actively (sizing, layout, position, spacing,
     * visibilityMode/opacity).
     */
    const emit = (group, line) => {
        if (group !== null && offGroups.has(group)) {
            const bucket = commentedByGroup.get(group);
            if (bucket)
                bucket.push(`/* ${line} */`);
            else
                commentedByGroup.set(group, [`/* ${line} */`]);
        }
        else {
            lines.push(line);
        }
    };
    const isRoot = el.id === ROOT_ELEMENT_ID;
    // When the parent is a flex OR grid container, this element is laid
    // out by that engine and should NOT have absolute positioning —
    // position/left/top become meaningless because the parent owns
    // placement.
    const inFlexParent = parent?.display === 'flex';
    const inGridParent = parent?.display === 'grid';
    const inLayoutParent = inFlexParent || inGridParent;
    // Different default set for root vs any other rect — a root defaults
    // to a white page background and web-idiomatic sizing (100% / auto)
    // so the exported CSS works outside Scamp. Everything else flows
    // through the same code path.
    const BASE = isRoot ? DEFAULT_ROOT_STYLES : DEFAULT_RECT_STYLES;
    // Sizing. The 'auto' mode is the implicit CSS default (no
    // declaration), so we deliberately emit nothing for it — that's
    // how round-trips stay text-stable for files that simply omit a
    // width or height.
    if (el.widthMode === 'stretch') {
        lines.push(`width: 100%;`);
    }
    else if (el.widthMode === 'fit-content') {
        lines.push(`width: fit-content;`);
    }
    else if (el.widthMode === 'fixed') {
        // `widthCustom` carries non-px values (vh, vw, em, calc, var, …)
        // verbatim. When set, it overrides the px fallback so the file
        // round-trips exactly what the user / agent wrote.
        if (el.widthCustom !== undefined && el.widthCustom.length > 0) {
            lines.push(`width: ${el.widthCustom};`);
        }
        else if (el.widthValue !== BASE.widthValue) {
            lines.push(`width: ${el.widthValue}px;`);
        }
    }
    if (el.heightMode === 'stretch') {
        lines.push(`height: 100%;`);
    }
    else if (el.heightMode === 'fit-content') {
        lines.push(`height: fit-content;`);
    }
    else if (el.heightMode === 'fixed') {
        if (el.heightCustom !== undefined && el.heightCustom.length > 0) {
            lines.push(`height: ${el.heightCustom};`);
        }
        else if (el.heightValue !== BASE.heightValue) {
            lines.push(`height: ${el.heightValue}px;`);
        }
    }
    // `min-height` — free-form string. Page-root defaults to `100vh`
    // (via DEFAULT_ROOT_STYLES) so generated pages have visible height
    // in any browser; non-root elements default to undefined and emit
    // nothing unless the user / agent set a value.
    if (el.minHeight !== undefined) {
        lines.push(`min-height: ${el.minHeight};`);
    }
    // Visibility "none" emits `display: none` and suppresses
    // layout-mode declarations it would override. Layout declarations
    // still come out when visibility is visible/hidden so the latent
    // state round-trips.
    if (el.visibilityMode === 'none') {
        lines.push('display: none;');
    }
    else {
        if (el.display !== BASE.display) {
            lines.push(`display: ${el.display};`);
        }
        if (el.display === 'grid') {
            // Grid container fields. Empty template strings + zero gaps
            // are skipped so the generated CSS only carries declarations
            // the user actually set.
            if (el.gridTemplateColumns.trim().length > 0) {
                lines.push(`grid-template-columns: ${el.gridTemplateColumns};`);
            }
            if (el.gridTemplateRows.trim().length > 0) {
                lines.push(`grid-template-rows: ${el.gridTemplateRows};`);
            }
            if (el.columnGap !== BASE.columnGap) {
                lines.push(`column-gap: ${el.columnGap}px;`);
            }
            if (el.rowGap !== BASE.rowGap) {
                lines.push(`row-gap: ${el.rowGap}px;`);
            }
            if (el.alignItems !== BASE.alignItems) {
                lines.push(`align-items: ${el.alignItems};`);
            }
            if (el.justifyItems !== BASE.justifyItems) {
                lines.push(`justify-items: ${el.justifyItems};`);
            }
        }
        else {
            // Flex (and the legacy "none" non-flex mode) emit the existing
            // flex container fields. Grid-only fields stay latent on the
            // element.
            if (el.flexDirection !== BASE.flexDirection) {
                lines.push(`flex-direction: ${el.flexDirection};`);
            }
            if (el.gap !== BASE.gap) {
                lines.push(`gap: ${el.gap}px;`);
            }
            if (el.alignItems !== BASE.alignItems) {
                lines.push(`align-items: ${el.alignItems};`);
            }
            if (el.justifyContent !== BASE.justifyContent) {
                lines.push(`justify-content: ${el.justifyContent};`);
            }
        }
    }
    // Grid-item declarations — apply when this element's PARENT is a
    // grid container. Free-text fields are emitted when non-empty;
    // align/justify-self only when not the default `stretch`.
    if (parent && parent.display === 'grid') {
        if (el.gridColumn.trim().length > 0) {
            lines.push(`grid-column: ${el.gridColumn};`);
        }
        if (el.gridRow.trim().length > 0) {
            lines.push(`grid-row: ${el.gridRow};`);
        }
        if (el.alignSelf !== BASE.alignSelf) {
            lines.push(`align-self: ${el.alignSelf};`);
        }
        if (el.justifySelf !== BASE.justifySelf) {
            lines.push(`justify-self: ${el.justifySelf};`);
        }
    }
    // Padding — emit when it differs from the tag's effective
    // default. For most tags that's `[0,0,0,0]`, so we omit when
    // every side is zero. For UA-padded tags (`<ul>`, `<ol>`,
    // `<dd>`) the effective default is `[0,0,0,40]`; an explicit
    // `[0,0,0,0]` on those tags is a user override of the UA
    // padding-inline-start and MUST emit, otherwise the file
    // re-renders with the browser's 40px back in place.
    const tagPaddingDefault = getTagDefaultPadding(tagFor(el));
    if (!paddingEquals(el.padding, tagPaddingDefault)) {
        const [pt, pr, pb, pl] = el.padding;
        lines.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    }
    // Margin — skipped on root because the page frame doesn't sit inside
    // another box on disk, and an exported `.root { margin: ... }` would
    // collide with the user's body/app-shell layout.
    if (!isRoot) {
        const [mt, mr, mb, ml] = el.margin;
        if (mt || mr || mb || ml) {
            lines.push(`margin: ${mt}px ${mr}px ${mb}px ${ml}px;`);
        }
    }
    // Appearance — togglable groups route through `emit(group, …)`
    // so the line either lands in the active buffer or in the
    // group's comment buffer (drained at the end of this function).
    if (el.backgroundColor !== BASE.backgroundColor) {
        emit('background', `background: ${el.backgroundColor};`);
    }
    const [tl, tr, br, bl] = el.borderRadius;
    if (tl || tr || br || bl) {
        emit('border', `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
    }
    const [bwt, bwr, bwb, bwl] = el.borderWidth;
    const hasBorder = bwt || bwr || bwb || bwl ||
        el.borderStyle !== BASE.borderStyle ||
        el.borderColor !== BASE.borderColor;
    if (hasBorder) {
        emit('border', `border-width: ${bwt}px ${bwr}px ${bwb}px ${bwl}px;`);
        emit('border', `border-style: ${el.borderStyle};`);
        emit('border', `border-color: ${el.borderColor};`);
    }
    // Text properties (only on text elements, only when set). Size-
    // related values are stored as full CSS strings so token refs and
    // non-px units round-trip without extra state.
    if (el.type === 'text') {
        if (el.fontFamily !== undefined)
            emit('typography', `font-family: ${el.fontFamily};`);
        if (el.fontSize !== undefined)
            emit('typography', `font-size: ${el.fontSize};`);
        if (el.fontWeight !== undefined)
            emit('typography', `font-weight: ${el.fontWeight};`);
        if (el.color !== undefined)
            emit('typography', `color: ${el.color};`);
        if (el.textAlign !== undefined)
            emit('typography', `text-align: ${el.textAlign};`);
        if (el.lineHeight !== undefined)
            emit('typography', `line-height: ${el.lineHeight};`);
        if (el.letterSpacing !== undefined) {
            emit('typography', `letter-spacing: ${el.letterSpacing};`);
        }
    }
    // Visibility + opacity — NOT togglable. These always emit
    // actively. (See `propertyGroups.ts` for why Visibility isn't
    // a togglable group.)
    if (el.visibilityMode === 'hidden') {
        lines.push('visibility: hidden;');
    }
    if (el.opacity !== BASE.opacity) {
        lines.push(`opacity: ${el.opacity};`);
    }
    // Box shadows — single shorthand per element. Empty list omits.
    if (el.boxShadows.length > 0) {
        emit('shadow', `box-shadow: ${formatBoxShadowShorthand(el.boxShadows)};`);
    }
    // Blend modes — `normal` is the default and emits no declaration.
    // The data layer permits any non-default keyword regardless of
    // whether a background image is set; the panel hides the
    // background-blend control when there's nothing to blend.
    if (el.mixBlendMode !== BASE.mixBlendMode) {
        emit('blend', `mix-blend-mode: ${el.mixBlendMode};`);
    }
    if (el.backgroundBlendMode !== BASE.backgroundBlendMode) {
        emit('blend', `background-blend-mode: ${el.backgroundBlendMode};`);
    }
    // Filters — single space-joined declaration per property. Empty
    // lists omit.
    if (el.filters.length > 0) {
        emit('filters', `filter: ${formatFilterList(el.filters)};`);
    }
    if (el.backdropFilters.length > 0) {
        emit('filters', `backdrop-filter: ${formatFilterList(el.backdropFilters)};`);
    }
    // Transitions — single shorthand per element. Empty list omits.
    if (el.transitions.length > 0) {
        emit('transitions', `transition: ${formatTransitionShorthand(el.transitions)};`);
    }
    // Animation — single shorthand per element. Multi-animation source
    // round-trips via customProperties.animation rather than this
    // typed field; the field is undefined when no animation applies.
    if (el.animation) {
        emit('animation', `animation: ${formatAnimationShorthand(el.animation)};`);
    }
    // Position. The element's typed `position` field decides the
    // strategy:
    //   - 'auto' (default) → Scamp's tree-shape rule: root is
    //     `position: relative`; non-root, non-flex/grid children get
    //     `position: absolute` + `left`/`top`; flex/grid children get
    //     no declaration (parent owns layout).
    //   - 'static' → emit `position: static` and skip offsets.
    //   - 'relative' / 'absolute' / 'fixed' / 'sticky' → emit the
    //     position keyword plus `left`/`top` from the stored x/y.
    //
    // An agent-written `position: fixed; top: 0;` round-trips through
    // this branch with the typed value preserved; `top`/`right`/
    // `bottom` other than `el.y` come back via customProperties and
    // override the typed `top` (CSS cascade — last declaration wins
    // for the same property name within a rule).
    if (el.position === 'auto') {
        if (isRoot) {
            lines.push(`position: relative;`);
        }
        else if (!inLayoutParent) {
            lines.push(`position: absolute;`);
            lines.push(`left: ${el.x}px;`);
            lines.push(`top: ${el.y}px;`);
        }
    }
    else {
        lines.push(`position: ${el.position};`);
        if (el.position !== 'static') {
            lines.push(`left: ${el.x}px;`);
            lines.push(`top: ${el.y}px;`);
        }
    }
    // customProperties always go last, in insertion order. They round-trip
    // through the file untouched — except when the typed branches above
    // already emitted a declaration for the same CSS property name. That
    // happens when a file has duplicate declarations (`height: 100%;
    // height: 100vh;`) where one value routes to a typed field and the
    // other lands in customProperties: emitting both would re-create the
    // duplicate on every save. Typed wins; the customProperties echo is
    // dropped. The in-memory `customProperties` bag stays as-is, and the
    // next round-trip parse won't re-populate it from a file that no
    // longer has the conflicting declaration.
    //
    // `customProperties` keys owned by a togglable group (e.g.
    // `background-image` → background) route through `emit(group, …)`
    // so they end up in the right comment block when the group is
    // toggled off.
    const emittedProps = collectEmittedPropNames(lines);
    for (const [key, value] of Object.entries(el.customProperties)) {
        if (emittedProps.has(key))
            continue;
        const ownedBy = CUSTOM_PROP_TO_GROUP[key] ?? null;
        emit(ownedBy, `${key}: ${value};`);
    }
    // Toggled-off groups: emit a `/* <group> off */` label followed
    // by every commented declaration we captured for that group.
    // Iterates `el.toggledOffGroups` directly (already sorted +
    // deduped at commit time) so the on-disk order is stable.
    // One blank-line separator between blocks; one before the first
    // block when there are active lines above.
    for (const group of el.toggledOffGroups) {
        if (lines.length > 0)
            lines.push('');
        lines.push(`/* ${group} off */`);
        const commented = commentedByGroup.get(group);
        if (commented) {
            for (const c of commented)
                lines.push(c);
        }
    }
    return lines;
};
/**
 * Pull the CSS property names out of an array of `prop: value;` lines.
 * Used by both the base-element emitter and the breakpoint-override
 * emitter to guard the customProperties pass against duplicating a
 * property the typed branches already emitted.
 */
const collectEmittedPropNames = (lines) => {
    const out = new Set();
    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon <= 0)
            continue;
        out.add(line.slice(0, colon).trim());
    }
    return out;
};
/**
 * Emit CSS declarations for a single breakpoint override. Unlike
 * `elementDeclarationLines` (which skips values equal to defaults),
 * this emits a declaration for every field explicitly set in the
 * override — the override's presence IS the user's intent.
 *
 * Paired with the element so width/height declarations can resolve
 * the mode+value combination. When only `widthMode` is in the
 * override, the value falls back to the element's base value.
 */
export const breakpointOverrideLines = (override, element) => {
    const lines = [];
    const has = (k) => Object.prototype.hasOwnProperty.call(override, k);
    // Same two-buffer pattern as `elementDeclarationLines`. Toggled-
    // off groups inherit from the element's base-level
    // `toggledOffGroups` array — the toggle is element-scoped, so
    // overrides for an off group are also commented out.
    const commentedByGroup = new Map();
    const offGroups = new Set(element.toggledOffGroups);
    const emit = (group, line) => {
        if (group !== null && offGroups.has(group)) {
            const bucket = commentedByGroup.get(group);
            if (bucket)
                bucket.push(`/* ${line} */`);
            else
                commentedByGroup.set(group, [`/* ${line} */`]);
        }
        else {
            lines.push(line);
        }
    };
    // Width — needs both mode and value. Either being in the override
    // triggers emission. `widthCustom` (verbatim CSS for non-px units)
    // overrides the px fallback when present.
    if (has('widthMode') || has('widthValue') || has('widthCustom')) {
        const mode = override.widthMode ?? element.widthMode;
        const value = override.widthValue ?? element.widthValue;
        const custom = has('widthCustom')
            ? override.widthCustom
            : element.widthCustom;
        if (mode === 'stretch')
            lines.push(`width: 100%;`);
        else if (mode === 'fit-content')
            lines.push(`width: fit-content;`);
        else if (mode === 'fixed') {
            if (custom !== undefined && custom.length > 0) {
                lines.push(`width: ${custom};`);
            }
            else {
                lines.push(`width: ${value}px;`);
            }
        }
        else if (mode === 'auto')
            lines.push(`width: auto;`);
    }
    if (has('heightMode') || has('heightValue') || has('heightCustom')) {
        const mode = override.heightMode ?? element.heightMode;
        const value = override.heightValue ?? element.heightValue;
        const custom = has('heightCustom')
            ? override.heightCustom
            : element.heightCustom;
        if (mode === 'stretch')
            lines.push(`height: 100%;`);
        else if (mode === 'fit-content')
            lines.push(`height: fit-content;`);
        else if (mode === 'fixed') {
            if (custom !== undefined && custom.length > 0) {
                lines.push(`height: ${custom};`);
            }
            else {
                lines.push(`height: ${value}px;`);
            }
        }
        else if (mode === 'auto')
            lines.push(`height: auto;`);
    }
    // `min-height` override — free-form string. Setting it to undefined
    // explicitly means "clear the inherited min-height at this
    // breakpoint" and emits `min-height: 0` to override the base
    // declaration in the cascade.
    if (has('minHeight')) {
        if (override.minHeight !== undefined) {
            lines.push(`min-height: ${override.minHeight};`);
        }
        else {
            lines.push(`min-height: 0;`);
        }
    }
    // Display / visibility. `visibility: none` means `display: none` in
    // our model; emit that instead of the raw display value.
    if (has('visibilityMode') && override.visibilityMode === 'none') {
        lines.push('display: none;');
    }
    else if (has('display') && override.display !== undefined) {
        lines.push(`display: ${override.display};`);
    }
    if (has('flexDirection') && override.flexDirection) {
        lines.push(`flex-direction: ${override.flexDirection};`);
    }
    if (has('gap') && override.gap !== undefined) {
        lines.push(`gap: ${override.gap}px;`);
    }
    if (has('alignItems') && override.alignItems) {
        lines.push(`align-items: ${override.alignItems};`);
    }
    if (has('justifyContent') && override.justifyContent) {
        lines.push(`justify-content: ${override.justifyContent};`);
    }
    // Grid container fields — emit only when overridden at this
    // breakpoint. Empty template strings emit `none` to clear an
    // inherited grid template; the user can opt out of the grid by
    // overriding `display` instead.
    if (has('gridTemplateColumns') && override.gridTemplateColumns !== undefined) {
        const v = override.gridTemplateColumns;
        lines.push(`grid-template-columns: ${v.length > 0 ? v : 'none'};`);
    }
    if (has('gridTemplateRows') && override.gridTemplateRows !== undefined) {
        const v = override.gridTemplateRows;
        lines.push(`grid-template-rows: ${v.length > 0 ? v : 'none'};`);
    }
    if (has('columnGap') && override.columnGap !== undefined) {
        lines.push(`column-gap: ${override.columnGap}px;`);
    }
    if (has('rowGap') && override.rowGap !== undefined) {
        lines.push(`row-gap: ${override.rowGap}px;`);
    }
    if (has('justifyItems') && override.justifyItems) {
        lines.push(`justify-items: ${override.justifyItems};`);
    }
    // Grid item fields.
    if (has('gridColumn') && override.gridColumn !== undefined) {
        const v = override.gridColumn;
        if (v.length > 0)
            lines.push(`grid-column: ${v};`);
    }
    if (has('gridRow') && override.gridRow !== undefined) {
        const v = override.gridRow;
        if (v.length > 0)
            lines.push(`grid-row: ${v};`);
    }
    if (has('alignSelf') && override.alignSelf) {
        lines.push(`align-self: ${override.alignSelf};`);
    }
    if (has('justifySelf') && override.justifySelf) {
        lines.push(`justify-self: ${override.justifySelf};`);
    }
    if (has('padding') && override.padding) {
        const [t, r, b, l] = override.padding;
        lines.push(`padding: ${t}px ${r}px ${b}px ${l}px;`);
    }
    if (has('margin') && override.margin) {
        const [t, r, b, l] = override.margin;
        lines.push(`margin: ${t}px ${r}px ${b}px ${l}px;`);
    }
    if (has('backgroundColor') && override.backgroundColor !== undefined) {
        emit('background', `background: ${override.backgroundColor};`);
    }
    if (has('borderRadius') && override.borderRadius) {
        const [tl, tr, br, bl] = override.borderRadius;
        emit('border', `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
    }
    if (has('borderWidth') && override.borderWidth) {
        const [t, r, b, l] = override.borderWidth;
        emit('border', `border-width: ${t}px ${r}px ${b}px ${l}px;`);
    }
    if (has('borderStyle') && override.borderStyle) {
        emit('border', `border-style: ${override.borderStyle};`);
    }
    if (has('borderColor') && override.borderColor !== undefined) {
        emit('border', `border-color: ${override.borderColor};`);
    }
    // Opacity + visibility are NOT togglable — always active.
    if (has('opacity') && override.opacity !== undefined) {
        lines.push(`opacity: ${override.opacity};`);
    }
    if (has('visibilityMode') && override.visibilityMode === 'hidden') {
        lines.push('visibility: hidden;');
    }
    else if (has('visibilityMode') && override.visibilityMode === 'visible') {
        lines.push('visibility: visible;');
    }
    // Box shadows — empty list at a breakpoint or state scope emits
    // `box-shadow: none` so the cascade explicitly clears the inherited
    // shadow rather than silently leaving it in place.
    if (has('boxShadows') && override.boxShadows !== undefined) {
        if (override.boxShadows.length === 0) {
            emit('shadow', 'box-shadow: none;');
        }
        else {
            emit('shadow', `box-shadow: ${formatBoxShadowShorthand(override.boxShadows)};`);
        }
    }
    // Blend modes — present-in-override means the user chose a value at
    // this scope. Writing `normal` explicitly clears an inherited
    // non-normal base (the convention transitions / box-shadow use with
    // `none`). Cascading-by-omission is what the user gets by not
    // touching the dropdown at all.
    if (has('mixBlendMode') && override.mixBlendMode !== undefined) {
        emit('blend', `mix-blend-mode: ${override.mixBlendMode};`);
    }
    if (has('backgroundBlendMode') &&
        override.backgroundBlendMode !== undefined) {
        emit('blend', `background-blend-mode: ${override.backgroundBlendMode};`);
    }
    // Filters — empty list at a breakpoint or state scope emits
    // `filter: none` (or `backdrop-filter: none`) so the cascade
    // explicitly clears the inherited list rather than silently
    // leaving it in place. Same convention as transitions and shadows.
    if (has('filters') && override.filters !== undefined) {
        if (override.filters.length === 0) {
            emit('filters', 'filter: none;');
        }
        else {
            emit('filters', `filter: ${formatFilterList(override.filters)};`);
        }
    }
    if (has('backdropFilters') && override.backdropFilters !== undefined) {
        if (override.backdropFilters.length === 0) {
            emit('filters', 'backdrop-filter: none;');
        }
        else {
            emit('filters', `backdrop-filter: ${formatFilterList(override.backdropFilters)};`);
        }
    }
    // Transitions — empty list at a breakpoint emits `transition: none`
    // so the cascade explicitly clears the inherited list rather than
    // silently leaving it in place.
    if (has('transitions') && override.transitions !== undefined) {
        if (override.transitions.length === 0) {
            emit('transitions', 'transition: none;');
        }
        else {
            emit('transitions', `transition: ${formatTransitionShorthand(override.transitions)};`);
        }
    }
    // Animation — only set on `StateOverride` (which extends
    // `BreakpointOverride` with `animation?`). The branch is
    // unreachable for an actual breakpoint override per the type
    // system. Keeping the check `has('animation')` rather than a
    // narrower cast so the emitter stays simple.
    if (has('animation')) {
        const anim = override
            .animation;
        if (anim) {
            emit('animation', `animation: ${formatAnimationShorthand(anim)};`);
        }
        else {
            // Explicit `animation: none` to clear an inherited animation.
            emit('animation', 'animation: none;');
        }
    }
    // Text properties — only meaningful on text elements but cheap to
    // emit based on presence in the override.
    if (has('fontFamily') && override.fontFamily !== undefined) {
        emit('typography', `font-family: ${override.fontFamily};`);
    }
    if (has('fontSize') && override.fontSize !== undefined) {
        emit('typography', `font-size: ${override.fontSize};`);
    }
    if (has('fontWeight') && override.fontWeight !== undefined) {
        emit('typography', `font-weight: ${override.fontWeight};`);
    }
    if (has('color') && override.color !== undefined) {
        emit('typography', `color: ${override.color};`);
    }
    if (has('textAlign') && override.textAlign !== undefined) {
        emit('typography', `text-align: ${override.textAlign};`);
    }
    if (has('lineHeight') && override.lineHeight !== undefined) {
        emit('typography', `line-height: ${override.lineHeight};`);
    }
    if (has('letterSpacing') && override.letterSpacing !== undefined) {
        emit('typography', `letter-spacing: ${override.letterSpacing};`);
    }
    // Position — emit the typed `position` keyword first when set at
    // this breakpoint, then x/y as left/top. `position: 'auto'` at a
    // breakpoint means "fall back to the cascade" — we don't emit
    // anything, the inherited position keyword applies.
    if (has('position') && override.position && override.position !== 'auto') {
        lines.push(`position: ${override.position};`);
    }
    if (has('x') && override.x !== undefined) {
        lines.push(`left: ${override.x}px;`);
    }
    if (has('y') && override.y !== undefined) {
        lines.push(`top: ${override.y}px;`);
    }
    // customProperties: free-form CSS the user / agent wrote at this
    // breakpoint. Emitted verbatim, in insertion order, last — except
    // when a typed branch above already emitted the same CSS prop
    // (duplicate-declaration scenario, see the base-element emitter for
    // the long version). Group-owned keys (e.g. `background-image`
    // → background) route through `emit(group, …)` so they end up
    // in the right comment block when the group is toggled off.
    if (override.customProperties) {
        const emittedProps = collectEmittedPropNames(lines);
        for (const [key, value] of Object.entries(override.customProperties)) {
            if (emittedProps.has(key))
                continue;
            const ownedBy = CUSTOM_PROP_TO_GROUP[key] ?? null;
            emit(ownedBy, `${key}: ${value};`);
        }
    }
    // Toggled-off group comment blocks — same emission pattern as
    // `elementDeclarationLines`. Appended after the active override
    // declarations, in canonical (sorted) order so on-disk text
    // stays stable. Iterates the element's `toggledOffGroups`
    // because the toggle is element-scoped.
    for (const group of element.toggledOffGroups) {
        const commented = commentedByGroup.get(group);
        if (!commented || commented.length === 0)
            continue;
        if (lines.length > 0)
            lines.push('');
        lines.push(`/* ${group} off */`);
        for (const c of commented)
            lines.push(c);
    }
    return lines;
};
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
const elementCssChunks = (el, parent) => {
    // Component instances don't own a class block — their visual
    // styles live inside the component definition's own
    // `[Name].module.css`. The instance JSX carries no `className`
    // and the page CSS module should NOT emit an empty `.…  {}` for
    // it.
    if (el.type === 'component-instance')
        return [];
    const chunks = [];
    const baseLines = elementDeclarationLines(el, parent);
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
const generateCss = (elements, rootId, breakpoints, customMediaBlocks, pageKeyframesBlocks) => {
    const ordered = collectElementsDfs(elements, rootId);
    // Per-element chunks — each chunk is base + state blocks + raw
    // pseudo-class blocks, in DFS order.
    const elementBlocks = ordered.flatMap((el) => {
        const parent = el.parentId ? elements[el.parentId] ?? null : null;
        return elementCssChunks(el, parent);
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
export const generateCode = (args) => {
    return {
        tsx: generateTsx(args.elements, args.rootId, args.pageName, args.cssModuleImportName ?? args.pageName, args.isComponent === true),
        css: generateCss(args.elements, args.rootId, args.breakpoints ?? [], args.customMediaBlocks ?? [], args.pageKeyframesBlocks ?? []),
    };
};
/**
 * Legacy flat-layout entry point. Equivalent to calling `generateCode`
 * with `cssModuleImportName: pageName` — kept as a separate name so the
 * call site reads as "this code path is for legacy projects" and so the
 * legacy path is straightforward to delete once the format is retired.
 */
export const generateCodeLegacy = (args) => generateCode({ ...args, cssModuleImportName: args.pageName });
