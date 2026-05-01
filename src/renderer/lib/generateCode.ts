import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import {
  ELEMENT_STATES,
  ROOT_ELEMENT_ID,
  slugifyName,
  type BreakpointOverride,
  type ElementStateName,
  type KeyframesBlock,
  type ScampElement,
  type StateOverride,
} from './element';
import {
  formatAnimationShorthand,
  formatTransitionShorthand,
} from './parsers';
import {
  DESKTOP_BREAKPOINT_ID,
  type Breakpoint,
} from '@shared/types';

/**
 * Pure function: produces real TSX + CSS module text from canvas state.
 *
 * Contract guarantees (also enforced by tests):
 *   - Output is deterministic — same input always produces the same output
 *   - Only emits CSS properties that differ from DEFAULT_RECT_STYLES
 *   - `customProperties` always go in verbatim, last, in their original order
 *   - The depth-first traversal matches the parent → childIds order
 *   - Text content is HTML-escaped
 *   - The function reads no external state — no Date.now, no Math.random
 */

export type GenerateCodeArgs = {
  elements: Record<string, ScampElement>;
  rootId: string;
  pageName: string;
  /**
   * Project's breakpoint table, ordered widest first. Used to emit
   * `@media (max-width: Npx)` blocks after the base class rules.
   * When omitted (or only contains desktop), no `@media` output is
   * emitted — backwards-compatible with callers that predate the
   * breakpoints feature.
   */
  breakpoints?: ReadonlyArray<Breakpoint>;
  /**
   * Raw `@media` blocks that the parser couldn't match to a known
   * breakpoint. Appended verbatim at the very end of the CSS so
   * agent-written / hand-written queries round-trip untouched.
   */
  customMediaBlocks?: ReadonlyArray<string>;
  /**
   * `@keyframes` blocks for the page. Emitted between the per-element
   * chunks and the `@media` blocks, in the order given. Multiple
   * elements can reference the same keyframe name; the block list
   * deduplicates by name on parse, so we trust the input here.
   */
  pageKeyframesBlocks?: ReadonlyArray<KeyframesBlock>;
  /**
   * Basename (no extension) of the CSS module the TSX should import.
   * The single point of divergence between the legacy flat layout
   * (where each page imports `./<pageName>.module.css` because all
   * pages share a folder) and the Next.js App Router layout (where
   * every page lives in its own folder and imports `./page.module.css`).
   * Defaults to `pageName` for back-compat with legacy callers.
   */
  cssModuleImportName?: string;
};

export type GeneratedCode = {
  tsx: string;
  css: string;
};

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const componentNameFromPage = (pageName: string): string => {
  const parts = pageName.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length === 0) return 'Page';
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

/**
 * The CSS class name for an element. When the element has a custom name,
 * the slugified name replaces the type prefix:
 *   - unnamed rect → `rect_a1b2`
 *   - named "Hero Card" → `hero-card_a1b2`
 *   - root → `root` (always)
 */
export const classNameFor = (el: ScampElement): string => {
  if (el.id === ROOT_ELEMENT_ID) return 'root';
  const prefix = el.name ? slugifyName(el.name) : '';
  const defaultPrefix =
    el.type === 'image'
      ? 'img'
      : el.type === 'input'
        ? 'input'
        : el.type === 'rectangle'
          ? 'rect'
          : 'text';
  return `${prefix.length > 0 ? prefix : defaultPrefix}_${el.id}`;
};

const indent = (level: number): string => '  '.repeat(level);

/** The HTML tag we'd use by default for an element of this type. */
const defaultTagFor = (el: ScampElement): string => {
  if (el.id === ROOT_ELEMENT_ID) return 'div';
  if (el.type === 'image') return 'img';
  if (el.type === 'input') return 'input';
  return el.type === 'text' ? 'p' : 'div';
};

/** The actual tag to emit / render — explicit override wins over the default. */
export const tagFor = (el: ScampElement): string => el.tag ?? defaultTagFor(el);

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
const formatAttribute = (name: string, value: string): string => {
  if (value === '') return name;
  return `${name}="${escapeHtml(value)}"`;
};

/**
 * Render the `<option>` children of a `<select>` element. Each option
 * is emitted on its own line, indented one level past the select.
 * Boolean `selected` follows the same empty-string convention as other
 * boolean attributes.
 */
const renderSelectOptions = (
  options: ReadonlyArray<{ value: string; label: string; selected?: boolean }>,
  level: number
): string =>
  options
    .map((opt) => {
      const attrs: string[] = [`value="${escapeHtml(opt.value)}"`];
      if (opt.selected) attrs.push('selected');
      return `${indent(level)}<option ${attrs.join(' ')}>${escapeHtml(opt.label)}</option>`;
    })
    .join('\n');

/**
 * Render a single element + its descendants as a JSX subtree.
 * Self-closes when the element has no children and (for text elements)
 * no text content.
 */
const renderJsx = (
  el: ScampElement,
  elements: Record<string, ScampElement>,
  level: number
): string => {
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

  const hasText = el.type === 'text' && typeof el.text === 'string' && el.text.length > 0;
  const hasChildren = el.childIds.length > 0;
  const fragments = el.inlineFragments;
  const hasFragments = fragments.length > 0;

  if (!hasChildren && !hasText && !hasFragments) {
    return `${indent(level)}${open} />`;
  }

  if (hasText && !hasChildren && !hasFragments) {
    return `${indent(level)}${open}>${escapeHtml(el.text ?? '')}</${tag}>`;
  }

  // Emit fragments before any element child, interleaved between
  // children, and after the last child — using each fragment's
  // `afterChildIndex`. Text fragments are escaped; JSX fragments are
  // emitted byte-for-byte from the captured source.
  const fragmentsAt = (idx: number): string =>
    fragments
      .filter((f) => f.afterChildIndex === idx)
      .map((f) => {
        const text = f.kind === 'text' ? escapeHtml(f.value) : f.source;
        return `${indent(level + 1)}${text}`;
      })
      .join('\n');

  const segments: string[] = [];
  if (hasText) segments.push(`${indent(level + 1)}${escapeHtml(el.text ?? '')}`);
  const before = fragmentsAt(-1);
  if (before.length > 0) segments.push(before);
  el.childIds.forEach((childId, i) => {
    const child = elements[childId];
    if (child) {
      const line = renderJsx(child, elements, level + 1);
      if (line.length > 0) segments.push(line);
    }
    const after = fragmentsAt(i);
    if (after.length > 0) segments.push(after);
  });

  const inner = segments.join('\n');
  return `${indent(level)}${open}>\n${inner}\n${indent(level)}</${tag}>`;
};

const generateTsx = (
  elements: Record<string, ScampElement>,
  rootId: string,
  pageName: string,
  cssModuleImportName: string
): string => {
  const root = elements[rootId];
  const componentName = componentNameFromPage(pageName);
  const importLine = `import styles from './${cssModuleImportName}.module.css';`;
  if (!root) {
    return `${importLine}\n\nexport default function ${componentName}() {\n  return null;\n}\n`;
  }
  const body = renderJsx(root, elements, 2);
  return `${importLine}\n\nexport default function ${componentName}() {\n  return (\n${body}\n  );\n}\n`;
};

/**
 * Build the list of `prop: value;` lines for one element. Skips anything
 * equal to its default; appends customProperties verbatim at the end.
 *
 * Exported so the properties panel can render what would be written to
 * disk for the selected element without having to re-implement the rules.
 */
export const elementDeclarationLines = (
  el: ScampElement,
  parent?: ScampElement | null
): string[] => {
  const lines: string[] = [];
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
  } else if (el.widthMode === 'fit-content') {
    lines.push(`width: fit-content;`);
  } else if (el.widthMode === 'fixed' && el.widthValue !== BASE.widthValue) {
    lines.push(`width: ${el.widthValue}px;`);
  }
  if (el.heightMode === 'stretch') {
    lines.push(`height: 100%;`);
  } else if (el.heightMode === 'fit-content') {
    lines.push(`height: fit-content;`);
  } else if (el.heightMode === 'fixed' && el.heightValue !== BASE.heightValue) {
    lines.push(`height: ${el.heightValue}px;`);
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
  } else {
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
    } else {
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

  // Padding (only when any side is non-zero)
  const [pt, pr, pb, pl] = el.padding;
  if (pt || pr || pb || pl) {
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

  // Appearance
  if (el.backgroundColor !== BASE.backgroundColor) {
    lines.push(`background: ${el.backgroundColor};`);
  }
  const [tl, tr, br, bl] = el.borderRadius;
  if (tl || tr || br || bl) {
    lines.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
  }
  const [bwt, bwr, bwb, bwl] = el.borderWidth;
  const hasBorder = bwt || bwr || bwb || bwl ||
    el.borderStyle !== BASE.borderStyle ||
    el.borderColor !== BASE.borderColor;
  if (hasBorder) {
    lines.push(`border-width: ${bwt}px ${bwr}px ${bwb}px ${bwl}px;`);
    lines.push(`border-style: ${el.borderStyle};`);
    lines.push(`border-color: ${el.borderColor};`);
  }

  // Text properties (only on text elements, only when set). Size-
  // related values are stored as full CSS strings so token refs and
  // non-px units round-trip without extra state.
  if (el.type === 'text') {
    if (el.fontFamily !== undefined) lines.push(`font-family: ${el.fontFamily};`);
    if (el.fontSize !== undefined) lines.push(`font-size: ${el.fontSize};`);
    if (el.fontWeight !== undefined) lines.push(`font-weight: ${el.fontWeight};`);
    if (el.color !== undefined) lines.push(`color: ${el.color};`);
    if (el.textAlign !== undefined) lines.push(`text-align: ${el.textAlign};`);
    if (el.lineHeight !== undefined) lines.push(`line-height: ${el.lineHeight};`);
    if (el.letterSpacing !== undefined) {
      lines.push(`letter-spacing: ${el.letterSpacing};`);
    }
  }

  // Visibility + opacity
  if (el.visibilityMode === 'hidden') {
    lines.push('visibility: hidden;');
  }
  if (el.opacity !== BASE.opacity) {
    lines.push(`opacity: ${el.opacity};`);
  }

  // Transitions — single shorthand per element. Empty list omits.
  if (el.transitions.length > 0) {
    lines.push(`transition: ${formatTransitionShorthand(el.transitions)};`);
  }

  // Animation — single shorthand per element. Multi-animation source
  // round-trips via customProperties.animation rather than this
  // typed field; the field is undefined when no animation applies.
  if (el.animation) {
    lines.push(`animation: ${formatAnimationShorthand(el.animation)};`);
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
    } else if (!inLayoutParent) {
      lines.push(`position: absolute;`);
      lines.push(`left: ${el.x}px;`);
      lines.push(`top: ${el.y}px;`);
    }
  } else {
    lines.push(`position: ${el.position};`);
    if (el.position !== 'static') {
      lines.push(`left: ${el.x}px;`);
      lines.push(`top: ${el.y}px;`);
    }
  }

  // customProperties always go last, in insertion order. They round-trip
  // through the file untouched.
  for (const [key, value] of Object.entries(el.customProperties)) {
    lines.push(`${key}: ${value};`);
  }

  return lines;
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
export const breakpointOverrideLines = (
  override: BreakpointOverride,
  element: ScampElement
): string[] => {
  const lines: string[] = [];
  const has = (k: keyof BreakpointOverride): boolean =>
    Object.prototype.hasOwnProperty.call(override, k);

  // Width — needs both mode and value. Either being in the override
  // triggers emission.
  if (has('widthMode') || has('widthValue')) {
    const mode = override.widthMode ?? element.widthMode;
    const value = override.widthValue ?? element.widthValue;
    if (mode === 'stretch') lines.push(`width: 100%;`);
    else if (mode === 'fit-content') lines.push(`width: fit-content;`);
    else if (mode === 'fixed') lines.push(`width: ${value}px;`);
    else if (mode === 'auto') lines.push(`width: auto;`);
  }
  if (has('heightMode') || has('heightValue')) {
    const mode = override.heightMode ?? element.heightMode;
    const value = override.heightValue ?? element.heightValue;
    if (mode === 'stretch') lines.push(`height: 100%;`);
    else if (mode === 'fit-content') lines.push(`height: fit-content;`);
    else if (mode === 'fixed') lines.push(`height: ${value}px;`);
    else if (mode === 'auto') lines.push(`height: auto;`);
  }

  // `min-height` override — free-form string. Setting it to undefined
  // explicitly means "clear the inherited min-height at this
  // breakpoint" and emits `min-height: 0` to override the base
  // declaration in the cascade.
  if (has('minHeight')) {
    if (override.minHeight !== undefined) {
      lines.push(`min-height: ${override.minHeight};`);
    } else {
      lines.push(`min-height: 0;`);
    }
  }

  // Display / visibility. `visibility: none` means `display: none` in
  // our model; emit that instead of the raw display value.
  if (has('visibilityMode') && override.visibilityMode === 'none') {
    lines.push('display: none;');
  } else if (has('display') && override.display !== undefined) {
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
    if (v.length > 0) lines.push(`grid-column: ${v};`);
  }
  if (has('gridRow') && override.gridRow !== undefined) {
    const v = override.gridRow;
    if (v.length > 0) lines.push(`grid-row: ${v};`);
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
    lines.push(`background: ${override.backgroundColor};`);
  }
  if (has('borderRadius') && override.borderRadius) {
    const [tl, tr, br, bl] = override.borderRadius;
    lines.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
  }
  if (has('borderWidth') && override.borderWidth) {
    const [t, r, b, l] = override.borderWidth;
    lines.push(`border-width: ${t}px ${r}px ${b}px ${l}px;`);
  }
  if (has('borderStyle') && override.borderStyle) {
    lines.push(`border-style: ${override.borderStyle};`);
  }
  if (has('borderColor') && override.borderColor !== undefined) {
    lines.push(`border-color: ${override.borderColor};`);
  }

  if (has('opacity') && override.opacity !== undefined) {
    lines.push(`opacity: ${override.opacity};`);
  }
  if (has('visibilityMode') && override.visibilityMode === 'hidden') {
    lines.push('visibility: hidden;');
  } else if (has('visibilityMode') && override.visibilityMode === 'visible') {
    lines.push('visibility: visible;');
  }

  // Transitions — empty list at a breakpoint emits `transition: none`
  // so the cascade explicitly clears the inherited list rather than
  // silently leaving it in place.
  if (has('transitions') && override.transitions !== undefined) {
    if (override.transitions.length === 0) {
      lines.push('transition: none;');
    } else {
      lines.push(
        `transition: ${formatTransitionShorthand(override.transitions)};`
      );
    }
  }

  // Animation — only set on `StateOverride` (which extends
  // `BreakpointOverride` with `animation?`). The branch is
  // unreachable for an actual breakpoint override per the type
  // system. Keeping the check `has('animation')` rather than a
  // narrower cast so the emitter stays simple.
  if (has('animation')) {
    const anim = (override as { animation?: import('./element').ElementAnimation })
      .animation;
    if (anim) {
      lines.push(`animation: ${formatAnimationShorthand(anim)};`);
    } else {
      // Explicit `animation: none` to clear an inherited animation.
      lines.push('animation: none;');
    }
  }

  // Text properties — only meaningful on text elements but cheap to
  // emit based on presence in the override.
  if (has('fontFamily') && override.fontFamily !== undefined) {
    lines.push(`font-family: ${override.fontFamily};`);
  }
  if (has('fontSize') && override.fontSize !== undefined) {
    lines.push(`font-size: ${override.fontSize};`);
  }
  if (has('fontWeight') && override.fontWeight !== undefined) {
    lines.push(`font-weight: ${override.fontWeight};`);
  }
  if (has('color') && override.color !== undefined) {
    lines.push(`color: ${override.color};`);
  }
  if (has('textAlign') && override.textAlign !== undefined) {
    lines.push(`text-align: ${override.textAlign};`);
  }
  if (has('lineHeight') && override.lineHeight !== undefined) {
    lines.push(`line-height: ${override.lineHeight};`);
  }
  if (has('letterSpacing') && override.letterSpacing !== undefined) {
    lines.push(`letter-spacing: ${override.letterSpacing};`);
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
  // breakpoint. Emitted verbatim, in insertion order, last.
  if (override.customProperties) {
    for (const [key, value] of Object.entries(override.customProperties)) {
      lines.push(`${key}: ${value};`);
    }
  }

  return lines;
};

/** True when the override object has any field set — used to decide
 *  whether an @media block needs a rule for this element. Type guard
 *  so callers get a narrowed non-undefined value. */
const overrideHasAny = (
  override: BreakpointOverride | undefined
): override is BreakpointOverride =>
  override !== undefined && Object.keys(override).length > 0;

const collectElementsDfs = (
  elements: Record<string, ScampElement>,
  rootId: string
): ScampElement[] => {
  const result: ScampElement[] = [];
  const visit = (id: string): void => {
    const el = elements[id];
    if (!el) return;
    result.push(el);
    for (const childId of el.childIds) visit(childId);
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
const stateBlockFor = (
  el: ScampElement,
  state: ElementStateName,
  override: StateOverride
): string | null => {
  if (Object.keys(override).length === 0) return null;
  const lines = breakpointOverrideLines(override as BreakpointOverride, el);
  if (lines.length === 0) return null;
  const body = lines.map((line) => `  ${line}`).join('\n');
  return `.${classNameFor(el)}:${state} {\n${body}\n}`;
};

/**
 * Build the chunk of CSS for a single element: its base class block
 * followed by any recognised state blocks (`:hover` → `:active` →
 * `:focus`) and finally any pseudo-class blocks the parser preserved
 * verbatim. The chunks are concatenated by `generateCss` to give
 * per-element grouping in the output file.
 */
const elementCssChunks = (
  el: ScampElement,
  parent: ScampElement | null
): string[] => {
  const chunks: string[] = [];

  const baseLines = elementDeclarationLines(el, parent);
  const baseBody = baseLines.map((line) => `  ${line}`).join('\n');
  chunks.push(`.${classNameFor(el)} {\n${baseBody}\n}`);

  const overrides = el.stateOverrides;
  if (overrides) {
    for (const state of ELEMENT_STATES) {
      const override = overrides[state];
      if (!override) continue;
      const block = stateBlockFor(el, state, override);
      if (block !== null) chunks.push(block);
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

const generateCss = (
  elements: Record<string, ScampElement>,
  rootId: string,
  breakpoints: ReadonlyArray<Breakpoint>,
  customMediaBlocks: ReadonlyArray<string>,
  pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>
): string => {
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
  const keyframesBlocks = pageKeyframesBlocks.map(
    (block) => `@keyframes ${block.name} {\n${block.body}\n}`
  );

  // @media blocks — widest first (excluding desktop, which is the
  // base). Source order with max-width queries means narrower
  // breakpoints appearing later win the cascade when both match.
  const mediaBlocks: string[] = [];
  for (const bp of breakpoints) {
    if (bp.id === DESKTOP_BREAKPOINT_ID) continue;
    const rules: string[] = [];
    for (const el of ordered) {
      const override = el.breakpointOverrides?.[bp.id];
      if (!overrideHasAny(override)) continue;
      const lines = breakpointOverrideLines(override, el);
      if (lines.length === 0) continue;
      const body = lines.map((line) => `    ${line}`).join('\n');
      rules.push(`  .${classNameFor(el)} {\n${body}\n  }`);
    }
    if (rules.length === 0) continue;
    mediaBlocks.push(
      `@media (max-width: ${bp.width}px) {\n${rules.join('\n\n')}\n}`
    );
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

export const generateCode = (args: GenerateCodeArgs): GeneratedCode => {
  return {
    tsx: generateTsx(
      args.elements,
      args.rootId,
      args.pageName,
      args.cssModuleImportName ?? args.pageName
    ),
    css: generateCss(
      args.elements,
      args.rootId,
      args.breakpoints ?? [],
      args.customMediaBlocks ?? [],
      args.pageKeyframesBlocks ?? []
    ),
  };
};

/**
 * Legacy flat-layout entry point. Equivalent to calling `generateCode`
 * with `cssModuleImportName: pageName` — kept as a separate name so the
 * call site reads as "this code path is for legacy projects" and so the
 * legacy path is straightforward to delete once the format is retired.
 */
export const generateCodeLegacy = (args: GenerateCodeArgs): GeneratedCode =>
  generateCode({ ...args, cssModuleImportName: args.pageName });
