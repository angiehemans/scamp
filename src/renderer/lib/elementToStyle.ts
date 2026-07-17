// @lib/elementToStyle.ts — pure element -> CSSProperties for the canvas
// renderer. Moved out of ElementRenderer.tsx (4.1) so it is unit-
// testable. `rootMinHeight` is now a required param (was defaulted to
// the UI-side EMPTY_FRAME_MIN_HEIGHT) to keep this module free of canvas
// component deps.
import { customPropsToStyle } from "./customProps";
import { ROOT_ELEMENT_ID, type PropertyGroup, type ScampElement } from "./element";
import { tagFor } from "./generateCode";
import { formatBoxShadowShorthand, formatFilterList } from "./parsers";
import { CUSTOM_PROP_TO_GROUP } from "./propertyGroups";
import { formatSpaceShorthand, formatSpaceValue, isZeroSpaceTuple, isZeroSpaceValue } from "./spaceValue";
import { getTagDefaultPadding, paddingEquals } from "./tagDefaults";
import { type ThemeToken } from "@shared/types";
import { type CSSProperties } from "react";

const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;
const URL_RELATIVE_RE = /url\(\s*["']?(\.\/[^"')]+)["']?\s*\)/g;
/**
 * Matches `url("/assets/foo.png")` (and its bare-path form). Used to
 * rewrite Next.js absolute server-root references on the canvas
 * preview, where the file actually lives at `<project>/public/assets/`.
 */
const URL_NEXTJS_ASSETS_RE = /url\(\s*["']?(\/assets\/[^"')]+)["']?\s*\)/g;

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
export const canvasRenderTag = (tag: string): string => {
  if (tag === 'dialog') return 'div';
  if (tag === 'svg') return 'div';
  return tag;
};

/**
 * Attribute names we never forward from the element's `attributes`
 * bag to the canvas DOM. Each has a reason:
 *   - tag-specific side effects we don't want on a design surface
 *     (`open` on dialog, `href` on anchor → navigation, etc.)
 *   - React/JSX-only names the DOM wouldn't understand
 */
export const CANVAS_SKIP_ATTRS_BY_TAG: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'target']),
  dialog: new Set(['open']),
  form: new Set(['action', 'method']),
  button: new Set(['type']),
};

/** Resolve a `var(--name)` reference against theme tokens. */
const resolveTokenColor = (
  value: string,
  tokens: ReadonlyArray<ThemeToken>
): string => {
  if (tokens.length === 0) return value;
  const m = value.match(VAR_RE);
  if (!m) return value;
  const found = tokens.find((t) => t.name === m[1]);
  return found ? found.value : 'transparent';
};

/**
 * Resolve a `var(--name)` reference against theme tokens for non-colour
 * properties. Unknown tokens return the raw value so React's inline
 * style system gets something it understands (falling back to browser
 * default rather than the "transparent" sentinel we use for colours).
 */
const resolveTokenValue = (
  value: string | undefined,
  tokens: ReadonlyArray<ThemeToken>
): string | undefined => {
  if (!value) return value;
  const m = value.match(VAR_RE);
  if (!m) return value;
  const found = tokens.find((t) => t.name === m[1]);
  return found ? found.value : value;
};


export const elementToStyle = (
  el: ScampElement,
  parentDisplay: 'flex' | 'grid' | 'none' | undefined,
  parentDirection: 'row' | 'column' | undefined,
  tokens: ReadonlyArray<ThemeToken>,
  projectDir: string | null,
  projectFormat: 'legacy' | 'nextjs',
  // When true, the element is being rendered AS the inner subtree
  // of a component instance — not as the active page's own root.
  // Suppresses the canvas-frame affordances (the root min-height
  // floor) that only make sense in the page / component editor's
  // canvas view.
  isInstanceInner: boolean = false,
  // The desired root min-height in logical pixels. Pages and
  // component-editor canvases pass their canvas height here so
  // the root element fills the visible canvas regardless of
  // content size. Defaults to the page-canvas constant so
  // instance-inner renders (which set isInstanceInner=true and
  // never hit this branch) don't accidentally pick up a stray
  // override.
  rootMinHeight: number,
  // When true, the active canvas is the COMPONENT editor. A fixed-height
  // root then keeps its own height instead of being stretched to fill the
  // artboard — resizing the component canvas is a viewport change (like a
  // browser window) and must not make a fixed-size component look taller.
  // The page root always grows via min-height (a page is a document).
  inComponentEditor: boolean = false
): CSSProperties => {
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
  const widthStyle =
    el.widthMode === 'stretch'
      ? '100%'
      : el.widthMode === 'fit-content'
        ? 'fit-content'
        : el.widthMode === 'auto'
          ? undefined
          : el.widthCustom !== undefined && el.widthCustom.length > 0
            ? el.widthCustom
            : el.widthValue;
  const heightStyle =
    el.heightMode === 'stretch'
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
  let effectiveWidth: string | number | undefined = widthStyle;
  // The root normally drops its own height and relies on the canvas
  // min-height floor (below) so it fills the artboard. In the COMPONENT
  // editor a FIXED-height root instead keeps that height and does NOT grow
  // with the canvas — resizing the artboard is a viewport change, like a
  // browser window, and must not make a fixed component look taller.
  // Stretch/auto/hug roots (and the page root) still fill + reflow.
  const rootKeepsFixedHeight =
    isRoot && inComponentEditor && el.heightMode === 'fixed';
  let effectiveHeight: string | number | undefined = isRoot
    ? rootKeepsFixedHeight
      ? heightStyle
      : undefined
    : heightStyle;
  const flexProps: CSSProperties = {};

  if (inFlexParent) {
    const widthIsMain = isRow;
    // Main axis stretch → flex: 1, drop the explicit size
    if (el.widthMode === 'stretch' && widthIsMain) {
      flexProps.flex = 1;
      flexProps.minWidth = 0;
      effectiveWidth = undefined;
    } else if (el.heightMode === 'stretch' && !widthIsMain) {
      flexProps.flex = 1;
      flexProps.minHeight = 0;
      effectiveHeight = undefined;
    }
    // Cross-axis stretch fill. The two axes are NOT symmetric:
    //   - Row parent → cross axis is the BLOCK axis (height). A
    //     percentage `height: 100%` collapses when the container's
    //     height is indefinite, so fall back to `align-self: stretch`
    //     to fill the cross axis.
    //   - Column parent → cross axis is the INLINE axis (width). A
    //     percentage `width: 100%` resolves against the container's
    //     definite inline size, so we KEEP it. Substituting
    //     `align-self: stretch` here would override the parent's
    //     `align-items` (e.g. `center` + a child `max-width` should
    //     centre the item) and pin the item to the start edge instead —
    //     diverging from the browser/preview. see
    //     docs/notes/canvas-cross-axis-stretch.md
    if (el.heightMode === 'stretch' && widthIsMain) {
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
  const offGroups = new Set<PropertyGroup>(el.toggledOffGroups);
  const isOff = (g: PropertyGroup): boolean => offGroups.has(g);

  const base: CSSProperties = {
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
    position:
      el.position !== 'auto'
        ? el.position
        : isRoot
          ? 'relative'
          : inLayoutParent
            ? 'relative'
            : 'absolute',
    left:
      el.position === 'static' || el.position === 'auto'
        ? isRoot || inLayoutParent
          ? undefined
          : el.x
        : el.x,
    top:
      el.position === 'static' || el.position === 'auto'
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
    minHeight: isRoot && !rootKeepsFixedHeight ? `${rootMinHeight}px` : undefined,
    ...flexProps,
    // `background` lives in the background group; `border-radius`
    // is a sizing/shape concern that doesn't get a toggle.
    background: isOff('background')
      ? undefined
      : resolveTokenColor(el.backgroundColor, tokens),
    borderRadius: formatSpaceShorthand(el.borderRadius),
    boxSizing: 'border-box',
    // Reset browser-default margins on semantic text tags (h1, p, etc.)
    // so the canvas position matches the stored coordinates.
    margin: 0,
  };
  if (
    !isOff('border') &&
    el.borderStyle !== 'none' &&
    !isZeroSpaceTuple(el.borderWidth)
  ) {
    base.borderWidth = formatSpaceShorthand(el.borderWidth);
    base.borderStyle = el.borderStyle;
    base.borderColor = resolveTokenColor(el.borderColor, tokens);
  }
  // SVG paint — applied so the canvas reflects the SvgSection controls.
  // The fill/stroke property on the wrapper recolours the shapes inside
  // (inherits + overrides their attributes — the standard svg recolour
  // mechanism). see docs/notes/svg-recolor.md
  if (el.fill !== undefined && el.fill.length > 0) {
    base.fill = resolveTokenColor(el.fill, tokens);
  }
  if (el.stroke !== undefined && el.stroke.length > 0) {
    base.stroke = resolveTokenColor(el.stroke, tokens);
  }
  if (el.strokeWidth !== undefined && el.strokeWidth > 0) {
    base.strokeWidth = el.strokeWidth;
  }
  // `currentColor` inside an svg resolves to the CSS `color` property, so
  // the SvgSection's "Current color" swatch writes `el.color`; apply it on
  // the wrapper (the text path above is text-only). see
  // docs/plans/svg-color-editing-plan.md
  if (el.tag === 'svg' && el.color !== undefined && el.color.length > 0) {
    base.color = resolveTokenColor(el.color, tokens);
  }
  if (el.display === 'flex') {
    base.display = 'flex';
    base.flexDirection = el.flexDirection;
    base.gap = formatSpaceValue(el.gap);
    base.alignItems = el.alignItems;
    base.justifyContent = el.justifyContent;
  } else if (el.display === 'grid') {
    base.display = 'grid';
    if (el.gridTemplateColumns.length > 0) {
      base.gridTemplateColumns = el.gridTemplateColumns;
    }
    if (el.gridTemplateRows.length > 0) {
      base.gridTemplateRows = el.gridTemplateRows;
    }
    if (!isZeroSpaceValue(el.columnGap)) base.columnGap = formatSpaceValue(el.columnGap);
    if (!isZeroSpaceValue(el.rowGap)) base.rowGap = formatSpaceValue(el.rowGap);
    base.alignItems = el.alignItems;
    base.justifyItems = el.justifyItems;
  }
  // Grid-item placement on the parent grid.
  if (inGridParent) {
    if (el.gridColumn.length > 0) base.gridColumn = el.gridColumn;
    if (el.gridRow.length > 0) base.gridRow = el.gridRow;
    if (el.alignSelf !== 'stretch') base.alignSelf = el.alignSelf;
    if (el.justifySelf !== 'stretch') base.justifySelf = el.justifySelf;
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
    base.padding = formatSpaceShorthand(el.padding);
  }
  if (!isZeroSpaceTuple(el.margin)) {
    base.margin = formatSpaceShorthand(el.margin);
  }
  if (el.type === 'text' && !isOff('typography')) {
    if (el.fontFamily !== undefined)
      base.fontFamily = resolveTokenValue(el.fontFamily, tokens);
    if (el.fontSize !== undefined)
      base.fontSize = resolveTokenValue(el.fontSize, tokens);
    if (el.fontWeight !== undefined) base.fontWeight = el.fontWeight;
    if (el.color !== undefined) base.color = resolveTokenColor(el.color, tokens);
    if (el.textAlign !== undefined) base.textAlign = el.textAlign;
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
  const filteredCustomProperties: Record<string, string> = {};
  for (const [key, value] of Object.entries(el.customProperties)) {
    const owningGroup = CUSTOM_PROP_TO_GROUP[key];
    if (owningGroup && isOff(owningGroup)) continue;
    filteredCustomProperties[key] = value;
  }
  const customStyle = customPropsToStyle(filteredCustomProperties);
  // Resolve relative `url("./...")` references in custom properties to
  // absolute `scamp-asset://` URLs so background-image etc. load correctly
  // on the canvas preview.
  if (projectDir) {
    for (const [key, value] of Object.entries(customStyle)) {
      if (typeof value !== 'string' || !value.includes('url(')) continue;
      let next = value.replace(URL_RELATIVE_RE, (_match, relPath: string) => {
        const absPath = `${projectDir}/${relPath.slice(2)}`;
        return `url("scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}")`;
      });
      if (projectFormat === 'nextjs') {
        next = next.replace(URL_NEXTJS_ASSETS_RE, (_match, absRef: string) => {
          // `/assets/foo.png` lives at `<project>/public/assets/foo.png`.
          const absPath = `${projectDir}/public${absRef}`;
          return `url("scamp-asset://localhost/${encodeURI(absPath.replace(/^\/+/, ''))}")`;
        });
      }
      (customStyle as Record<string, string>)[key] = next;
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
