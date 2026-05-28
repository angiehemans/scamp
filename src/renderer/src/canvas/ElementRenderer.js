import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { createElement, useEffect, useRef, } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID, } from '@lib/element';
import { classNameFor, tagFor } from '@lib/generateCode';
import { DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { resolveElementAtBreakpoint } from '@lib/breakpointCascade';
import { resolveElementAtState } from '@lib/stateCascade';
import { formatAnimationShorthand, formatBoxShadowShorthand, formatFilterList, } from '@lib/parsers';
import { customPropsToStyle } from '@lib/customProps';
import { CUSTOM_PROP_TO_GROUP } from '@lib/propertyGroups';
import { getTagDefaultPadding, paddingEquals } from '@lib/tagDefaults';
import { EMPTY_FRAME_MIN_HEIGHT } from './Viewport';
import styles from './ElementRenderer.module.css';
const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;
const URL_RELATIVE_RE = /url\(\s*["']?(\.\/[^"')]+)["']?\s*\)/g;
/**
 * Matches `url("/assets/foo.png")` (and its bare-path form). Used to
 * rewrite Next.js absolute server-root references on the canvas
 * preview, where the file actually lives at `<project>/public/assets/`.
 */
const URL_NEXTJS_ASSETS_RE = /url\(\s*["']?(\/assets\/[^"')]+)["']?\s*\)/g;
/** HTML void elements — React throws if createElement receives children for these. */
const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'source', 'track', 'wbr',
]);
/** True iff root matches the blank-component scaffold (style-aware). see docs/notes/components-data-model.md */
const isScaffoldRoot = (root) => {
    return (root.childIds.length === 0 &&
        root.inlineFragments.length === 0 &&
        root.backgroundColor === DEFAULT_ROOT_STYLES.backgroundColor &&
        root.widthMode === DEFAULT_ROOT_STYLES.widthMode &&
        root.heightMode === DEFAULT_ROOT_STYLES.heightMode &&
        root.borderWidth.every((v) => v === 0) &&
        root.borderRadius.every((v) => v === 0) &&
        root.padding.every((v) => v === 0) &&
        root.boxShadows.length === 0 &&
        root.opacity === DEFAULT_ROOT_STYLES.opacity &&
        root.minHeight === DEFAULT_ROOT_STYLES.minHeight);
};
/**
 * A handful of tags we deliberately render with a different element on
 * the canvas than in the generated TSX. The canvas is a design surface,
 * not a runtime — a real `<dialog open>` would go modal, a real
 * `<svg>` would try to interpret its source. Both scenarios interfere
 * with placing, selecting, and sizing the box.
 *
 * The generator still emits the true tag to disk; this override only
 * affects the DOM node React renders inside the canvas iframe.
 */
const canvasRenderTag = (tag) => {
    if (tag === 'dialog')
        return 'div';
    if (tag === 'svg')
        return 'div';
    return tag;
};
/**
 * Attribute names we never forward from the element's `attributes`
 * bag to the canvas DOM. Each has a reason:
 *   - tag-specific side effects we don't want on a design surface
 *     (`open` on dialog, `href` on anchor → navigation, etc.)
 *   - React/JSX-only names the DOM wouldn't understand
 */
const CANVAS_SKIP_ATTRS_BY_TAG = {
    a: new Set(['href', 'target']),
    dialog: new Set(['open']),
    form: new Set(['action', 'method']),
    button: new Set(['type']),
};
/** Resolve a `var(--name)` reference against theme tokens. */
const resolveTokenColor = (value, tokens) => {
    if (tokens.length === 0)
        return value;
    const m = value.match(VAR_RE);
    if (!m)
        return value;
    const found = tokens.find((t) => t.name === m[1]);
    return found ? found.value : 'transparent';
};
/**
 * Resolve a `var(--name)` reference against theme tokens for non-colour
 * properties. Unknown tokens return the raw value so React's inline
 * style system gets something it understands (falling back to browser
 * default rather than the "transparent" sentinel we use for colours).
 */
const resolveTokenValue = (value, tokens) => {
    if (!value)
        return value;
    const m = value.match(VAR_RE);
    if (!m)
        return value;
    const found = tokens.find((t) => t.name === m[1]);
    return found ? found.value : value;
};
const elementToStyle = (el, parentDisplay, parentDirection, tokens, projectDir, projectFormat, 
// When true, the element is being rendered AS the inner subtree
// of a component instance — not as the active page's own root.
// Suppresses the canvas-frame affordances (the root min-height
// floor) that only make sense in the page / component editor's
// canvas view.
isInstanceInner = false, 
// The desired root min-height in logical pixels. Pages and
// component-editor canvases pass their canvas height here so
// the root element fills the visible canvas regardless of
// content size. Defaults to the page-canvas constant so
// instance-inner renders (which set isInstanceInner=true and
// never hit this branch) don't accidentally pick up a stray
// override.
rootMinHeight = EMPTY_FRAME_MIN_HEIGHT) => {
    // `isRoot` drives canvas-frame affordances (sticky min-height,
    // dropping fixed height). Those only apply when the element is
    // genuinely the active page's own root — not when the same id
    // appears inside a component's parsed tree being rendered as an
    // embedded subtree.
    const isRoot = el.id === ROOT_ELEMENT_ID && !isInstanceInner;
    // Flex / grid children flow with the layout engine — drop
    // position/left/top so the browser places them. Matches what we
    // emit in generateCode.
    const inFlexParent = parentDisplay === 'flex';
    const inGridParent = parentDisplay === 'grid';
    const inLayoutParent = inFlexParent || inGridParent;
    const isRow = parentDirection !== 'column'; // default flex direction is row
    // 'auto' produces `undefined` so the rendered element inherits the
    // browser default — exactly what an absent CSS declaration would do.
    // For 'fixed' mode, `widthCustom` (verbatim CSS like `100vh`,
    // `calc(...)`, `var(--w)`) wins over the px fallback so the canvas
    // matches the file output.
    const widthStyle = el.widthMode === 'stretch'
        ? '100%'
        : el.widthMode === 'fit-content'
            ? 'fit-content'
            : el.widthMode === 'auto'
                ? undefined
                : el.widthCustom !== undefined && el.widthCustom.length > 0
                    ? el.widthCustom
                    : el.widthValue;
    const heightStyle = el.heightMode === 'stretch'
        ? '100%'
        : el.heightMode === 'fit-content'
            ? 'fit-content'
            : el.heightMode === 'auto'
                ? undefined
                : el.heightCustom !== undefined && el.heightCustom.length > 0
                    ? el.heightCustom
                    : el.heightValue;
    // The page root uses `min-height` so the page frame grows vertically
    // with its content (like a real web page). Other elements use a fixed
    // `height` so they stay the size the user gave them.
    // In a flex parent, `width/height: 100%` can collapse to 0 because
    // there's no explicit containing-block size for `%` to resolve
    // against. Handle stretch per-axis:
    //   - Main axis stretch → `flex: 1` (grow to fill available space)
    //   - Cross axis stretch → `align-self: stretch` (fill cross axis)
    // The main axis depends on the parent's flex-direction (row → width
    // is main, column → height is main).
    let effectiveWidth = widthStyle;
    let effectiveHeight = isRoot ? undefined : heightStyle;
    const flexProps = {};
    if (inFlexParent) {
        const widthIsMain = isRow;
        // Main axis stretch → flex: 1, drop the explicit size
        if (el.widthMode === 'stretch' && widthIsMain) {
            flexProps.flex = 1;
            flexProps.minWidth = 0;
            effectiveWidth = undefined;
        }
        else if (el.heightMode === 'stretch' && !widthIsMain) {
            flexProps.flex = 1;
            flexProps.minHeight = 0;
            effectiveHeight = undefined;
        }
        // Cross axis stretch → align-self: stretch (drop the explicit size)
        if (el.widthMode === 'stretch' && !widthIsMain) {
            flexProps.alignSelf = 'stretch';
            effectiveWidth = undefined;
        }
        else if (el.heightMode === 'stretch' && widthIsMain) {
            flexProps.alignSelf = 'stretch';
            effectiveHeight = undefined;
        }
    }
    // Element-scoped property-group toggles. When a group is off,
    // the renderer skips writing its styles so the canvas matches the
    // generator (which emits the same decls inside a comment block).
    // `transitions` and `animation` aren't applied to the typed style
    // here (transitions only matter mid-state-change, animation is
    // gated below on the preview path), so the relevant guards live
    // alongside those branches.
    const offGroups = new Set(el.toggledOffGroups);
    const isOff = (g) => offGroups.has(g);
    const base = {
        // Flex children render as `position: relative` so they remain a
        // positioning context for their own `position: absolute` descendants
        // (e.g. a text child placed inside a flex-placed rect). Without this
        // the text would anchor to the nearest positioned ancestor instead —
        // typically root — and escape the visual box of its parent even
        // though the tree structure puts it inside.
        // Typed `position` overrides Scamp's tree-shape default. `auto`
        // (default) keeps the original behaviour — root + flex/grid
        // children render as `relative` so absolutely-positioned
        // descendants anchor inside them; everything else is `absolute`.
        // Any explicit value (`fixed`, `sticky`, etc.) renders as written.
        position: el.position !== 'auto'
            ? el.position
            : isRoot
                ? 'relative'
                : inLayoutParent
                    ? 'relative'
                    : 'absolute',
        left: el.position === 'static' || el.position === 'auto'
            ? isRoot || inLayoutParent
                ? undefined
                : el.x
            : el.x,
        top: el.position === 'static' || el.position === 'auto'
            ? isRoot || inLayoutParent
                ? undefined
                : el.y
            : el.y,
        width: effectiveWidth,
        height: effectiveHeight,
        // Canvas-only floor on the root's rendered height. Without this,
        // root defaults to `height: auto` and collapses to its content
        // size — flex layout then has no vertical space to distribute, so
        // `justify-content: center` on a flex-column root appears not to
        // work. Matches the frame's visible min-height so the user's flex
        // centering intent reads correctly on the canvas. NOT written to
        // the exported CSS — users who want centering in production still
        // need to set `min-height: 100vh` themselves.
        minHeight: isRoot ? `${rootMinHeight}px` : undefined,
        ...flexProps,
        // `background` lives in the background group; `border-radius`
        // is a sizing/shape concern that doesn't get a toggle.
        background: isOff('background')
            ? undefined
            : resolveTokenColor(el.backgroundColor, tokens),
        borderRadius: `${el.borderRadius[0]}px ${el.borderRadius[1]}px ${el.borderRadius[2]}px ${el.borderRadius[3]}px`,
        boxSizing: 'border-box',
        // Reset browser-default margins on semantic text tags (h1, p, etc.)
        // so the canvas position matches the stored coordinates.
        margin: 0,
    };
    const [bwt, bwr, bwb, bwl] = el.borderWidth;
    if (!isOff('border') && el.borderStyle !== 'none' && (bwt || bwr || bwb || bwl)) {
        base.borderWidth = `${bwt}px ${bwr}px ${bwb}px ${bwl}px`;
        base.borderStyle = el.borderStyle;
        base.borderColor = resolveTokenColor(el.borderColor, tokens);
    }
    if (el.display === 'flex') {
        base.display = 'flex';
        base.flexDirection = el.flexDirection;
        base.gap = el.gap;
        base.alignItems = el.alignItems;
        base.justifyContent = el.justifyContent;
    }
    else if (el.display === 'grid') {
        base.display = 'grid';
        if (el.gridTemplateColumns.length > 0) {
            base.gridTemplateColumns = el.gridTemplateColumns;
        }
        if (el.gridTemplateRows.length > 0) {
            base.gridTemplateRows = el.gridTemplateRows;
        }
        if (el.columnGap > 0)
            base.columnGap = el.columnGap;
        if (el.rowGap > 0)
            base.rowGap = el.rowGap;
        base.alignItems = el.alignItems;
        base.justifyItems = el.justifyItems;
    }
    // Grid-item placement on the parent grid.
    if (inGridParent) {
        if (el.gridColumn.length > 0)
            base.gridColumn = el.gridColumn;
        if (el.gridRow.length > 0)
            base.gridRow = el.gridRow;
        if (el.alignSelf !== 'stretch')
            base.alignSelf = el.alignSelf;
        if (el.justifySelf !== 'stretch')
            base.justifySelf = el.justifySelf;
    }
    // Apply an inline `padding` override only when the typed
    // padding differs from the tag's effective default. For most
    // tags that default is `[0,0,0,0]` and we skip the inline
    // style, letting the browser's UA rules apply (which are also
    // zero). For UA-padded tags (`<ul>`, `<ol>`, `<dd>`) the
    // typed default is `[0,0,0,40]` — matching the UA's
    // `padding-inline-start: 40px` — so we still skip the inline
    // style and let the browser render its 40px naturally. A user
    // value that differs from the tag default (e.g. zero padding
    // on a `<ul>`) emits the inline override so the canvas reads
    // 0 and matches the generated CSS file.
    const tagPaddingDefault = getTagDefaultPadding(tagFor(el));
    if (!paddingEquals(el.padding, tagPaddingDefault)) {
        const [pt, pr, pb, pl] = el.padding;
        base.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    }
    const [mt, mr, mb, ml] = el.margin;
    if (mt || mr || mb || ml) {
        base.margin = `${mt}px ${mr}px ${mb}px ${ml}px`;
    }
    if (el.type === 'text' && !isOff('typography')) {
        if (el.fontFamily !== undefined)
            base.fontFamily = resolveTokenValue(el.fontFamily, tokens);
        if (el.fontSize !== undefined)
            base.fontSize = resolveTokenValue(el.fontSize, tokens);
        if (el.fontWeight !== undefined)
            base.fontWeight = el.fontWeight;
        if (el.color !== undefined)
            base.color = resolveTokenColor(el.color, tokens);
        if (el.textAlign !== undefined)
            base.textAlign = el.textAlign;
        if (el.lineHeight !== undefined)
            base.lineHeight = resolveTokenValue(el.lineHeight, tokens);
        if (el.letterSpacing !== undefined)
            base.letterSpacing = resolveTokenValue(el.letterSpacing, tokens);
    }
    if (el.type === 'image') {
        base.objectFit = 'cover';
        base.display = 'block';
    }
    // Visibility + opacity
    // - `visibility: hidden` renders literally so canvas matches export.
    // - `visibility: none` is NOT applied literally (would hit-test out of
    //   existence); the `.hiddenNone` class dims + stripes the element so
    //   it stays selectable. CSS export still emits `display: none`.
    if (el.visibilityMode === 'hidden') {
        base.visibility = 'hidden';
    }
    // Dim the element by 65% when hidden-none; combine with user opacity
    // so a 50%-opaque element reads as ~17% when also hidden.
    const hiddenMultiplier = el.visibilityMode === 'none' ? 0.35 : 1;
    const effectiveOpacity = (el.opacity ?? 1) * hiddenMultiplier;
    if (effectiveOpacity !== 1) {
        base.opacity = effectiveOpacity;
    }
    // Box shadows are stored as a typed list; format the shorthand the
    // same way the generator does so the canvas matches the file output.
    // Empty list → no declaration (browser default).
    if (!isOff('shadow') && el.boxShadows.length > 0) {
        base.boxShadow = formatBoxShadowShorthand(el.boxShadows);
    }
    // Blend modes — only apply when non-default so we don't fight with
    // browser inheritance for elements that haven't been touched.
    if (!isOff('blend')) {
        if (el.mixBlendMode !== 'normal') {
            base.mixBlendMode = el.mixBlendMode;
        }
        if (el.backgroundBlendMode !== 'normal') {
            base.backgroundBlendMode = el.backgroundBlendMode;
        }
    }
    // Filters / backdrop-filter — same pattern as box-shadow: format
    // the typed list so the canvas matches the file output. Empty list
    // → no declaration (browser default).
    if (!isOff('filters')) {
        if (el.filters.length > 0) {
            base.filter = formatFilterList(el.filters);
        }
        if (el.backdropFilters.length > 0) {
            base.backdropFilter = formatFilterList(el.backdropFilters);
        }
    }
    // Spread customProperties LAST so unmapped CSS the user / agent
    // wrote (box-shadow, line-height, font-family, margin, …) actually
    // renders on the canvas. Anything in customProperties is, by
    // construction, NOT a property scamp routes to a typed field — so
    // there's no conflict with the assignments above. The reset
    // `margin: 0` we apply earlier IS overridable here, which is what
    // we want: a user-written `margin-bottom: 8px` should win over the
    // browser-default-reset.
    // Filter group-owned customProperties (e.g. `background-image`,
    // `background-size`) when their group is toggled off so the canvas
    // matches the generator's commented-out output.
    const filteredCustomProperties = {};
    for (const [key, value] of Object.entries(el.customProperties)) {
        const owningGroup = CUSTOM_PROP_TO_GROUP[key];
        if (owningGroup && isOff(owningGroup))
            continue;
        filteredCustomProperties[key] = value;
    }
    const customStyle = customPropsToStyle(filteredCustomProperties);
    // Resolve relative `url("./...")` references in custom properties to
    // absolute `scamp-asset://` URLs so background-image etc. load correctly
    // on the canvas preview.
    if (projectDir) {
        for (const [key, value] of Object.entries(customStyle)) {
            if (typeof value !== 'string' || !value.includes('url('))
                continue;
            let next = value.replace(URL_RELATIVE_RE, (_match, relPath) => {
                const absPath = `${projectDir}/${relPath.slice(2)}`;
                return `url("scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}")`;
            });
            if (projectFormat === 'nextjs') {
                next = next.replace(URL_NEXTJS_ASSETS_RE, (_match, absRef) => {
                    // `/assets/foo.png` lives at `<project>/public/assets/foo.png`.
                    const absPath = `${projectDir}/public${absRef}`;
                    return `url("scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}")`;
                });
            }
            customStyle[key] = next;
        }
    }
    return { ...base, ...customStyle };
};
/**
 * Render an element subtree that lives in a separate elements map
 * (not the canvas store's page-elements). Used by the
 * component-instance branch of `ElementRenderer` to render the
 * subtree from `componentTrees[name].elements` — that map is a
 * completely separate set of ids from the page's elements, so the
 * normal `<ElementRenderer elementId={id} />` recursion (which
 * reads from `state.elements`) wouldn't find them.
 *
 * No selection / edit / animation-preview affordances apply here —
 * the inner DOM is read-only from the page's perspective. The
 * outer `ElementRenderer` wrapper around the instance handles the
 * selection outline + double-click-to-edit; everything inside
 * has `pointer-events: none` so all clicks reach the wrapper.
 *
 * Component instances nested inside a component definition (slot
 * composition) are explicitly out of scope per the components
 * plan; we render them as a labelled placeholder.
 */
const renderComponentSubtree = (element, elementsMap, parentDisplay, parentDirection, propOverrides, tokens, projectDir, projectFormat, projectPath, 
/**
 * Threaded through every recursive call so the wrapper that
 * tags prop-text knows which instance owns the value. The
 * canvas hit-test and the prop-edit commit both key off this
 * id — without it, two instances of the same component on one
 * page would write into each other's overrides.
 */
instanceId, 
/**
 * The current edit target, if any. When the recursion reaches
 * a text element whose `prop` matches AND whose owning instance
 * matches `instanceId`, that node renders as a contentEditable
 * span instead of a plain text node. Null when nothing is being
 * edited, or when an edit on a different instance is in flight.
 */
editingProp, 
/**
 * Called when the user commits an edit (blur or Enter on the
 * contentEditable). Caller is responsible for clearing
 * `editingInstanceProp` after the commit.
 */
onCommitProp, 
/**
 * Called when the user enters edit mode on a prop-text (double-
 * click) or exits via Escape. The canvas store's
 * `setEditingInstanceProp` is the natural binding; the prop
 * is wrapped here so the renderer doesn't have to pull it from
 * the store at every node.
 */
onChangeEditingProp, 
/**
 * True when the owning instance is the current selection. Prop-text
 * only shows its dashed edit affordance while the instance is
 * selected — otherwise the page is noisy with outlines around every
 * editable string on every instance.
 */
instanceSelected) => {
    // Slot composition deferred: nested instances render as placeholders.
    if (element.type === 'component-instance') {
        return (_jsxs("div", { style: {
                padding: '4px 8px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px dashed var(--accent, #6366f1)',
                borderRadius: 4,
                color: 'var(--text-secondary)',
                fontSize: 12,
            }, children: ["Nested ", element.componentName] }, element.id));
    }
    const style = elementToStyle(element, parentDisplay, parentDirection, tokens, projectDir, projectFormat, 
    // Inner subtree: strip page-canvas-only affordances (the
    // 900px EMPTY_FRAME_MIN_HEIGHT floor, the
    // "root drops fixed height" behaviour) so the component's
    // root renders at its real designed size, not as a
    // full-canvas-sized white box.
    true);
    const storedTag = tagFor(element);
    const tag = canvasRenderTag(storedTag);
    const className = classNameFor(element);
    const props = {
        'data-scamp-id': className,
        style,
    };
    // Forward agent-written attributes through the same per-tag deny
    // list the page renderer uses (no href navigation, no form
    // action, etc.).
    if (element.attributes) {
        const skip = CANVAS_SKIP_ATTRS_BY_TAG[storedTag] ?? new Set();
        for (const [name, value] of Object.entries(element.attributes)) {
            if (skip.has(name))
                continue;
            props[name] = value === '' ? true : value;
        }
    }
    // <img> src/alt routing — same `scamp-asset://` rewrite as the
    // page renderer so component-defined images load correctly on
    // the canvas preview.
    if (element.type === 'image' && storedTag === 'img') {
        let resolvedSrc = element.src ?? '';
        if (projectPath && resolvedSrc.startsWith('./')) {
            const absPath = `${projectPath.replace(/\\/g, '/')}/${resolvedSrc.slice(2)}`;
            resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
        }
        else if (projectPath &&
            projectFormat === 'nextjs' &&
            resolvedSrc.startsWith('/')) {
            const absPath = `${projectPath.replace(/\\/g, '/')}/public${resolvedSrc}`;
            resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
        }
        props['src'] = resolvedSrc;
        props['alt'] = element.alt ?? '';
    }
    if (VOID_TAGS.has(tag)) {
        return createElement(tag, { ...props, key: element.id });
    }
    const isText = element.type === 'text';
    // Substitute propOverride → literal default for prop-text.
    // see docs/notes/components-data-model.md
    const propName = isText && typeof element.prop === 'string' && element.prop.length > 0
        ? element.prop
        : null;
    const overrideValue = propName !== null ? propOverrides[propName] : undefined;
    const defaultText = isText && typeof element.text === 'string' ? element.text : undefined;
    const textContent = overrideValue !== undefined ? overrideValue : defaultText;
    const hasText = isText && typeof textContent === 'string' && textContent.length > 0;
    const hasChildren = element.childIds.length > 0;
    // Prop-text always carries the hit-test attrs and overrides the
    // inner wrapper's `pointer-events: none` so `elementsFromPoint`
    // surfaces it for `propTextHitTest`. The dashed edit affordance
    // only shows once the owning instance is selected — otherwise a
    // page full of instances would be noisy with outlines around
    // every editable string. The affordance lives on a CSS-module
    // class so PNG / SVG export can strip it the same way it strips
    // `.selected`.
    const isEditingThisProp = propName !== null && editingProp === propName;
    if (isText && propName !== null) {
        props['data-scamp-instance-id'] = instanceId;
        props['data-scamp-prop'] = propName;
        const baseStyle = props['style'] ?? {};
        props['style'] = { ...baseStyle, pointerEvents: 'auto' };
        if (instanceSelected) {
            const existing = typeof props['className'] === 'string' ? props['className'] : '';
            props['className'] = existing
                ? `${existing} ${styles.propEditAffordance}`
                : styles.propEditAffordance;
        }
    }
    // Locked text on an instance — hint via native tooltip.
    if (isText && propName === null) {
        props['title'] = 'Locked text — edit in the component definition.';
    }
    if (!hasChildren && !hasText && !isEditingThisProp) {
        return createElement(tag, { ...props, key: element.id });
    }
    if (isEditingThisProp && propName !== null) {
        const handleBlur = (e) => {
            const next = e.currentTarget.textContent ?? '';
            onCommitProp(propName, next);
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onChangeEditingProp(null);
            }
            else if (e.key === 'Enter') {
                // Enter commits (line breaks need explicit \n escape, not surfaced).
                e.preventDefault();
                const next = e.currentTarget.textContent ?? '';
                onCommitProp(propName, next);
            }
        };
        return createElement(tag, {
            ...props,
            key: element.id,
            contentEditable: true,
            suppressContentEditableWarning: true,
            spellCheck: false,
            onBlur: handleBlur,
            onKeyDown: handleKeyDown,
            ref: (node) => {
                // Focus + select-all on mount.
                if (!node)
                    return;
                node.focus({ preventScroll: true });
                const range = document.createRange();
                range.selectNodeContents(node);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
            },
        }, textContent ?? '');
    }
    if (hasText && !hasChildren) {
        return createElement(tag, { ...props, key: element.id }, textContent);
    }
    // Derive parent display / direction once so children's
    // elementToStyle behaves correctly inside flex / grid parents.
    const childParentDisplay = element.display === 'flex' || element.display === 'grid'
        ? element.display
        : 'none';
    const childParentDirection = element.display === 'flex' ? element.flexDirection : undefined;
    const children = element.childIds
        .map((childId) => {
        const child = elementsMap[childId];
        if (!child)
            return null;
        return renderComponentSubtree(child, elementsMap, childParentDisplay, childParentDirection, propOverrides, tokens, projectDir, projectFormat, projectPath, instanceId, editingProp, onCommitProp, onChangeEditingProp, instanceSelected);
    })
        .filter((c) => c !== null);
    return createElement(tag, { ...props, key: element.id }, children);
};
export const ElementRenderer = ({ elementId }) => {
    const rawElement = useCanvasStore((s) => s.elements[elementId]);
    const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
    const activeStateName = useCanvasStore((s) => s.activeStateName);
    const breakpoints = useCanvasStore((s) => s.breakpoints);
    const isSelected = useCanvasStore((s) => s.selectedElementIds.includes(elementId));
    // Resolve overrides at render time. Selected elements get the
    // active state's overrides layered in (the state switcher *is* the
    // canvas preview); non-selected elements always render their
    // default state. When nothing applies, this is a no-op identity
    // return.
    const previewState = isSelected && activeStateName !== null ? activeStateName : null;
    const element = rawElement
        ? resolveElementAtState(rawElement, activeBreakpointId, breakpoints, previewState)
        : undefined;
    // Parent resolution doesn't carry a state preview — only the
    // selected element previews its hover/active/focus styles. The
    // parent's layout (flex / grid behaviour) is whatever the
    // breakpoint cascade resolves.
    const parentResolved = useCanvasStore((s) => {
        const el = s.elements[elementId];
        if (!el || !el.parentId)
            return undefined;
        const parent = s.elements[el.parentId];
        if (!parent)
            return undefined;
        return resolveElementAtBreakpoint(parent, s.activeBreakpointId, s.breakpoints);
    });
    const parentDisplay = parentResolved?.display;
    const parentDirection = parentResolved?.flexDirection;
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    // Canvas-frame min height — page editor uses
    // EMPTY_FRAME_MIN_HEIGHT, component editor uses the
    // user-configured `componentCanvas[name].height`. ProjectShell
    // keeps this in sync with the active target. The root element
    // uses it as its own min-height so the root fills the visible
    // canvas regardless of content size.
    const canvasMinHeight = useCanvasStore((s) => s.canvasMinHeight);
    // Canvas animation preview — set when the user clicks Play in the
    // AnimationSection. The matching element re-renders with a fresh
    // `key` so React forces a remount and the CSS animation plays
    // from the top. Non-matching elements never receive an animation
    // declaration on the canvas, so loops don't run during normal
    // editing — too distracting.
    const previewAnimation = useCanvasStore((s) => s.previewAnimation?.elementId === elementId ? s.previewAnimation : null);
    const projectPath = useCanvasStore((s) => s.projectPath);
    const isEditing = useCanvasStore((s) => s.editingElementId === elementId);
    const setEditingElement = useCanvasStore((s) => s.setEditingElement);
    const setElementText = useCanvasStore((s) => s.setElementText);
    const selectElement = useCanvasStore((s) => s.selectElement);
    // Component-tree lookup for `component-instance` elements. The
    // selector is keyed by `componentName`, so a tree edit that
    // doesn't change THIS instance's component name is a no-op
    // re-render. When the element isn't an instance, the selector
    // returns undefined and React skips the deeper subscription.
    const componentTreeForInstance = useCanvasStore((s) => {
        const rawEl = s.elements[elementId];
        if (!rawEl || rawEl.type !== 'component-instance')
            return undefined;
        if (!rawEl.componentName)
            return undefined;
        return s.componentTrees[rawEl.componentName];
    });
    const requestComponentNavigation = useCanvasStore((s) => s.requestComponentNavigation);
    // Phase 6: per-instance inline editing. The pair is non-null when
    // a prop-text inside SOME instance is in contentEditable mode.
    // The recursive subtree render compares the instance id to
    // decide whether to render the contentEditable form.
    const editingInstanceProp = useCanvasStore((s) => s.editingInstanceProp);
    const setEditingInstanceProp = useCanvasStore((s) => s.setEditingInstanceProp);
    const setPropOverride = useCanvasStore((s) => s.setPropOverride);
    // The ref is attached to the element's DOM node — for text elements
    // it's the contentEditable target during edit mode.
    const elementRef = useRef(null);
    // Focus the editable region as soon as the element enters edit mode and
    // select all of its text so the user can immediately overwrite it.
    useEffect(() => {
        if (!isEditing)
            return;
        const node = elementRef.current;
        if (!node)
            return;
        // preventScroll: the element is inside a `transform: scale`d frame in
        // an overflow:auto container. Default focus() scrolls the element
        // into view, which on Mac visibly shifts the canvas and makes the
        // newly-placed text appear offset from where the user clicked.
        node.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }, [isEditing]);
    // While editing, a click anywhere outside the editable should commit and
    // exit. We trigger that by blurring the element, which fires the existing
    // onBlur handler.
    useEffect(() => {
        if (!isEditing)
            return;
        const handleDocPointerDown = (e) => {
            const node = elementRef.current;
            if (!node)
                return;
            if (node.contains(e.target))
                return;
            node.blur();
        };
        document.addEventListener('mousedown', handleDocPointerDown);
        return () => document.removeEventListener('mousedown', handleDocPointerDown);
    }, [isEditing]);
    if (!element)
        return null;
    const isText = element.type === 'text';
    const isImage = element.type === 'image';
    const isComponentInstance = element.type === 'component-instance';
    const projectDir = projectPath ? projectPath.replace(/\\/g, '/') : null;
    const baseStyle = elementToStyle(element, parentDisplay, parentDirection, themeTokens, projectDir, projectFormat, false, canvasMinHeight);
    // When the canvas is previewing a non-default state for this
    // element, suppress transitions so the user sees the resolved end
    // state instantly rather than an animation halfway through.
    // Renderer-only — has no effect on the file on disk.
    let style = previewState !== null
        ? { ...baseStyle, transition: 'none' }
        : baseStyle;
    // Animation preview: when the user clicks Play, apply the resolved
    // animation as an inline declaration. Iteration is clamped to 1 so
    // even infinite loops play once on the canvas — preview should be a
    // single demonstration, not a perpetual distraction. `paused`
    // animations skip the preview entirely (the user explicitly
    // chose to pause). The React `key` on the element forces a remount
    // each Play click so the animation re-runs from the top.
    if (previewAnimation !== null &&
        element.animation &&
        element.animation.playState !== 'paused' &&
        !element.toggledOffGroups.includes('animation')) {
        style = {
            ...style,
            animation: formatAnimationShorthand({
                ...element.animation,
                iterationCount: 1,
            }),
        };
    }
    // Component-instance render branch. Instances appear as a
    // single selectable element on the page tree; the visible
    // contents are the component definition's own element subtree,
    // rendered from `componentTrees[name].elements`. We wrap the
    // subtree in a positioned div that owns selection / double-
    // click / context-menu, and apply `pointer-events: none` to
    // the inner subtree so every click lands on the wrapper.
    //
    // Double-click navigates the canvas into the component editor
    // for this instance's component (one-shot request consumed by
    // `ProjectShell`'s `pendingComponentNavigation` effect).
    if (isComponentInstance) {
        const handleInstanceClick = (e) => {
            e.stopPropagation();
            selectElement(element.id);
        };
        const handleInstanceDoubleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const name = element.componentName;
            if (name)
                requestComponentNavigation(name);
        };
        const handleInstanceContextMenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectElement(element.id);
            window.dispatchEvent(new CustomEvent('scamp:open-element-context-menu', {
                detail: { x: e.clientX, y: e.clientY, elementId: element.id },
            }));
        };
        const wrapperProps = {
            'data-element-id': element.id,
            'data-scamp-instance-id': element.instanceId ?? '',
            className: `${styles.element} ${isSelected ? styles.selected : ''}`.trim(),
            style,
            onClick: handleInstanceClick,
            onDoubleClick: handleInstanceDoubleClick,
            onContextMenu: handleInstanceContextMenu,
        };
        // Missing-component placeholder (componentName not in cache).
        if (!componentTreeForInstance) {
            return (_jsxs("div", { ...wrapperProps, style: {
                    ...style,
                    padding: '8px 12px',
                    background: 'rgba(220, 38, 38, 0.08)',
                    border: '1px dashed #dc2626',
                    borderRadius: 4,
                    color: '#7f1d1d',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                }, children: ["Missing component: ", element.componentName ?? '(unnamed)'] }));
        }
        const root = componentTreeForInstance.elements[componentTreeForInstance.rootId];
        const isEmptyComponent = root !== undefined && isScaffoldRoot(root);
        // Only honour the edit target when it points at THIS instance.
        const editingPropForThis = editingInstanceProp && editingInstanceProp.instanceId === element.id
            ? editingInstanceProp.propName
            : null;
        const handleCommitProp = (propName, value) => {
            setPropOverride(element.id, propName, value);
            setEditingInstanceProp(null);
        };
        const handleChangeEditingProp = (propName) => {
            if (propName === null) {
                setEditingInstanceProp(null);
            }
            else {
                setEditingInstanceProp({ instanceId: element.id, propName });
            }
        };
        const inner = root
            ? renderComponentSubtree(root, componentTreeForInstance.elements, 
            // Pass page-side layout context so flex/grid still applies.
            parentDisplay, parentDirection, element.propOverrides ?? {}, themeTokens, projectDir, projectFormat, projectPath, element.id, editingPropForThis, handleCommitProp, handleChangeEditingProp, isSelected)
            : null;
        if (isEmptyComponent) {
            return (_jsxs("div", { ...wrapperProps, style: {
                    ...style,
                    padding: '12px 16px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px dashed var(--accent, #6366f1)',
                    borderRadius: 4,
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    minWidth: 80,
                    minHeight: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }, children: [element.componentName ?? 'Component', " (empty \u2014 double-click to edit)"] }));
        }
        // The inner wrapper is a real `display: block` div (NOT
        // `display: contents`). `display: contents` makes the
        // wrapper transparent to layout, so percentage widths inside
        // the component leak up to the page root's containing block
        // — a component whose root has `width: 100%` then expands to
        // the full page canvas instead of hugging the instance
        // wrapper. With a real block in place, the component's
        // children resolve their percentage widths against the inner
        // div, which is itself content-sized, so `100%` falls back
        // to `auto` and the instance hugs its content as expected.
        return (_jsx("div", { ...wrapperProps, children: _jsx("div", { style: { pointerEvents: 'none', display: 'block' }, "aria-hidden": "true", children: inner }) }));
    }
    // The actual HTML tag — uses the element's stored override if any,
    // otherwise the type's default (`p` for text, `div` for rect).
    const storedTag = tagFor(element);
    const tag = canvasRenderTag(storedTag);
    const handleEditableBlur = (e) => {
        const next = e.currentTarget.textContent ?? '';
        setElementText(element.id, next);
        setEditingElement(null);
    };
    const handleEditableKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
        }
        // Allow Enter for line breaks; commit on blur instead.
    };
    // Build a single set of props for the dynamic-tag element. Text and
    // rectangle differ only in their children: text renders the element's
    // text directly inside (so the tag wraps the text the way real HTML
    // does), rectangles render their child elements recursively.
    const handleContextMenu = (e) => {
        // Don't open a context menu while the user is mid-text-edit on
        // this element — the browser's native edit menu is more useful
        // there.
        if (isText && isEditing)
            return;
        e.preventDefault();
        e.stopPropagation();
        // Select the element so the properties panel switches to its
        // WYSIWYG view and the Export section's scope reflects the
        // right-clicked target.
        selectElement(element.id);
        window.dispatchEvent(new CustomEvent('scamp:open-element-context-menu', {
            detail: { x: e.clientX, y: e.clientY, elementId: element.id },
        }));
    };
    const props = {
        // `data-scamp-id` mirrors the CSS class name, matching what the code
        // generator writes to disk. `data-element-id` is the raw internal id
        // used by canvas hit-testing and selection — keep it separate so
        // renames don't force a refactor of every lookup site.
        'data-scamp-id': classNameFor(element),
        'data-element-id': element.id,
        onContextMenu: handleContextMenu,
        // Animation preview: increment the React key on each Play click
        // so React remounts the element and the CSS animation plays from
        // the top. Stays undefined when not previewing so we don't churn
        // the DOM during normal renders.
        ...(previewAnimation !== null
            ? { key: `preview-${previewAnimation.key}` }
            : {}),
        className: `${styles.element} ${isSelected ? styles.selected : ''} ${isText && isEditing ? styles.textEditing : ''} ${element.visibilityMode === 'none' ? styles.hiddenNone : ''}`.trim(),
        style,
        ref: elementRef,
    };
    // Forward tag-specific attributes from the element's attribute bag
    // to the canvas DOM so the preview reflects them (e.g. input
    // placeholder, textarea rows, video controls). A small per-tag deny
    // list blocks attrs that would trigger side effects (navigation,
    // form submission) on the canvas.
    if (element.attributes) {
        const skip = CANVAS_SKIP_ATTRS_BY_TAG[storedTag] ?? new Set();
        for (const [name, value] of Object.entries(element.attributes)) {
            if (skip.has(name))
                continue;
            // Boolean attributes stored as "" map to React-style `true`.
            props[name] = value === '' ? true : value;
        }
    }
    // Interaction side-effects prevention for tags that would otherwise
    // navigate or submit. The canvas is a design surface, not a runtime.
    if (storedTag === 'a' || storedTag === 'button') {
        const prevOnClick = props['onClick'];
        props['onClick'] = (e) => {
            e.preventDefault();
            if (typeof prevOnClick === 'function')
                prevOnClick(e);
        };
    }
    if (isText && isEditing) {
        props['contentEditable'] = true;
        props['suppressContentEditableWarning'] = true;
        props['onBlur'] = handleEditableBlur;
        props['onKeyDown'] = handleEditableKeyDown;
        // Stop pointer events from bubbling so the user can place the
        // cursor / select text without triggering canvas interactions.
        props['onPointerDown'] = (e) => e.stopPropagation();
    }
    // Only real `<img>` elements carry typed src/alt. Other media tags
    // (video, iframe, svg) store their src/title/etc. in the attribute
    // bag, which we've already spread above.
    if (isImage && storedTag === 'img') {
        // The element stores a path that makes sense at runtime: legacy
        // projects use `./assets/foo.png` (relative to the page file);
        // nextjs projects use `/assets/foo.png` (Next.js serves `public/`
        // at the URL root). In the Electron renderer neither resolves
        // against the project folder, so map both to the custom
        // `scamp-asset://` protocol registered in the main process.
        let resolvedSrc = element.src ?? '';
        if (projectPath && resolvedSrc.startsWith('./')) {
            const absPath = `${projectPath.replace(/\\/g, '/')}/${resolvedSrc.slice(2)}`;
            resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
        }
        else if (projectPath &&
            projectFormat === 'nextjs' &&
            resolvedSrc.startsWith('/')) {
            // Nextjs absolute server-root path → `<project>/public/<path>`.
            const absPath = `${projectPath.replace(/\\/g, '/')}/public${resolvedSrc}`;
            resolvedSrc = `scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}`;
        }
        props['src'] = resolvedSrc;
        props['alt'] = element.alt ?? '';
    }
    // Void HTML elements (img, input, br, hr, etc.) cannot have children
    // in React — even an empty array throws. Short-circuit for any void
    // tag so agent-written markup that uses <input />, <br />, etc.
    // renders without crashing.
    if (VOID_TAGS.has(tag)) {
        return createElement(tag, props);
    }
    const children = isText
        ? (element.text ?? '')
        : element.childIds.map((childId) => (_jsx(ElementRenderer, { elementId: childId }, childId)));
    return createElement(tag, props, children);
};
