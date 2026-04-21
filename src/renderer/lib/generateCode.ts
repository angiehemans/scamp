import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import { ROOT_ELEMENT_ID, slugifyName, type ScampElement } from './element';

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

  if (!hasChildren && !hasText) {
    return `${indent(level)}${open} />`;
  }

  if (hasText && !hasChildren) {
    return `${indent(level)}${open}>${escapeHtml(el.text ?? '')}</${tag}>`;
  }

  const childLines = el.childIds
    .map((childId) => {
      const child = elements[childId];
      if (!child) return '';
      return renderJsx(child, elements, level + 1);
    })
    .filter((line) => line.length > 0)
    .join('\n');

  const inner = hasText
    ? `${indent(level + 1)}${escapeHtml(el.text ?? '')}\n${childLines}`
    : childLines;

  return `${indent(level)}${open}>\n${inner}\n${indent(level)}</${tag}>`;
};

const generateTsx = (
  elements: Record<string, ScampElement>,
  rootId: string,
  pageName: string
): string => {
  const root = elements[rootId];
  const componentName = componentNameFromPage(pageName);
  const importLine = `import styles from './${pageName}.module.css';`;
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
  // When the parent is a flex container, this element is a flex item and
  // should NOT have absolute positioning. Position/left/top become
  // meaningless because flex layout owns its placement.
  const inFlexParent = parent?.display === 'flex';
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

  // Visibility "none" emits `display: none` and suppresses flex
  // declarations it would override. Flex declarations still come out
  // when visibility is visible/hidden so the latent state round-trips.
  if (el.visibilityMode === 'none') {
    lines.push('display: none;');
  } else {
    if (el.display !== BASE.display) {
      lines.push(`display: ${el.display};`);
    }
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

  // Position. Root is always `position: relative` (no coordinates —
  // it's the outermost element and has no parent to anchor against).
  // Non-root uses absolute positioning within the parent EXCEPT when
  // the parent is a flex container; flex layout owns placement there.
  if (isRoot) {
    lines.push(`position: relative;`);
  } else if (!inFlexParent) {
    lines.push(`position: absolute;`);
    lines.push(`left: ${el.x}px;`);
    lines.push(`top: ${el.y}px;`);
  }

  // customProperties always go last, in insertion order. They round-trip
  // through the file untouched.
  for (const [key, value] of Object.entries(el.customProperties)) {
    lines.push(`${key}: ${value};`);
  }

  return lines;
};

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

const generateCss = (
  elements: Record<string, ScampElement>,
  rootId: string
): string => {
  const ordered = collectElementsDfs(elements, rootId);
  const blocks = ordered.map((el) => {
    const parent = el.parentId ? elements[el.parentId] : null;
    const lines = elementDeclarationLines(el, parent);
    const body = lines.map((line) => `  ${line}`).join('\n');
    return `.${classNameFor(el)} {\n${body}\n}`;
  });
  return `${blocks.join('\n\n')}\n`;
};

export const generateCode = (args: GenerateCodeArgs): GeneratedCode => {
  return {
    tsx: generateTsx(args.elements, args.rootId, args.pageName),
    css: generateCss(args.elements, args.rootId),
  };
};
