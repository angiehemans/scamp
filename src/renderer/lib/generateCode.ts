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
  const defaultPrefix = el.type === 'rectangle' ? 'rect' : 'text';
  return `${prefix.length > 0 ? prefix : defaultPrefix}_${el.id}`;
};

const indent = (level: number): string => '  '.repeat(level);

/** The HTML tag we'd use by default for an element of this type. */
const defaultTagFor = (el: ScampElement): string => {
  if (el.id === ROOT_ELEMENT_ID) return 'div';
  return el.type === 'text' ? 'p' : 'div';
};

/** The actual tag to emit / render — explicit override wins over the default. */
export const tagFor = (el: ScampElement): string => el.tag ?? defaultTagFor(el);

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
  const open = `<${tag} data-scamp-id="${className}" className={styles.${className}}`;

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

  if (isRoot) {
    // Root is the page frame — always emit width, min-height, position so
    // the page renders predictably outside scamp. We use `min-height`
    // rather than `height` so the page can grow vertically when its
    // content exceeds the base canvas size, exactly like a real web page.
    lines.push(`width: ${el.widthValue}px;`);
    lines.push(`min-height: ${el.heightValue}px;`);
    lines.push(`position: relative;`);

    // Background, flex container properties, padding, border, and border
    // radius are emitted only when they differ from the root defaults so
    // an unedited page produces clean output.
    if (el.backgroundColor !== DEFAULT_ROOT_STYLES.backgroundColor) {
      lines.push(`background: ${el.backgroundColor};`);
    }
    if (el.display !== DEFAULT_ROOT_STYLES.display) {
      lines.push(`display: ${el.display};`);
    }
    if (el.flexDirection !== DEFAULT_ROOT_STYLES.flexDirection) {
      lines.push(`flex-direction: ${el.flexDirection};`);
    }
    if (el.gap !== DEFAULT_ROOT_STYLES.gap) {
      lines.push(`gap: ${el.gap}px;`);
    }
    if (el.alignItems !== DEFAULT_ROOT_STYLES.alignItems) {
      lines.push(`align-items: ${el.alignItems};`);
    }
    if (el.justifyContent !== DEFAULT_ROOT_STYLES.justifyContent) {
      lines.push(`justify-content: ${el.justifyContent};`);
    }
    const [pt, pr, pb, pl] = el.padding;
    if (pt || pr || pb || pl) {
      lines.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    }
    // Note: margin is intentionally NOT emitted for the root element — the
    // page frame doesn't sit inside another box on disk.
    const [rtl, rtr, rbr, rbl] = el.borderRadius;
    if (rtl || rtr || rbr || rbl) {
      lines.push(`border-radius: ${rtl}px ${rtr}px ${rbr}px ${rbl}px;`);
    }
    const [rwt, rwr, rwb, rwl] = el.borderWidth;
    const hasRootBorder = rwt || rwr || rwb || rwl ||
      el.borderStyle !== DEFAULT_ROOT_STYLES.borderStyle ||
      el.borderColor !== DEFAULT_ROOT_STYLES.borderColor;
    if (hasRootBorder) {
      lines.push(`border-width: ${rwt}px ${rwr}px ${rwb}px ${rwl}px;`);
      lines.push(`border-style: ${el.borderStyle};`);
      lines.push(`border-color: ${el.borderColor};`);
    }
  } else {
    // Sizing. The 'auto' mode is the implicit CSS default (no
    // declaration), so we deliberately emit nothing for it — that's
    // how round-trips stay text-stable for files that simply omit a
    // width or height.
    if (el.widthMode === 'stretch') {
      lines.push(`width: 100%;`);
    } else if (el.widthMode === 'fit-content') {
      lines.push(`width: fit-content;`);
    } else if (el.widthMode === 'fixed' && el.widthValue !== DEFAULT_RECT_STYLES.widthValue) {
      lines.push(`width: ${el.widthValue}px;`);
    }
    if (el.heightMode === 'stretch') {
      lines.push(`height: 100%;`);
    } else if (el.heightMode === 'fit-content') {
      lines.push(`height: fit-content;`);
    } else if (el.heightMode === 'fixed' && el.heightValue !== DEFAULT_RECT_STYLES.heightValue) {
      lines.push(`height: ${el.heightValue}px;`);
    }

    // Display + flex container properties
    if (el.display !== DEFAULT_RECT_STYLES.display) {
      lines.push(`display: ${el.display};`);
    }
    if (el.flexDirection !== DEFAULT_RECT_STYLES.flexDirection) {
      lines.push(`flex-direction: ${el.flexDirection};`);
    }
    if (el.gap !== DEFAULT_RECT_STYLES.gap) {
      lines.push(`gap: ${el.gap}px;`);
    }
    if (el.alignItems !== DEFAULT_RECT_STYLES.alignItems) {
      lines.push(`align-items: ${el.alignItems};`);
    }
    if (el.justifyContent !== DEFAULT_RECT_STYLES.justifyContent) {
      lines.push(`justify-content: ${el.justifyContent};`);
    }

    // Padding (only when any side is non-zero)
    const [pt, pr, pb, pl] = el.padding;
    if (pt || pr || pb || pl) {
      lines.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    }

    // Margin (only when any side is non-zero) — same conditional pattern.
    const [mt, mr, mb, ml] = el.margin;
    if (mt || mr || mb || ml) {
      lines.push(`margin: ${mt}px ${mr}px ${mb}px ${ml}px;`);
    }

    // Appearance
    if (el.backgroundColor !== DEFAULT_RECT_STYLES.backgroundColor) {
      lines.push(`background: ${el.backgroundColor};`);
    }
    const [tl, tr, br, bl] = el.borderRadius;
    if (tl || tr || br || bl) {
      lines.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`);
    }
    const [bwt, bwr, bwb, bwl] = el.borderWidth;
    const hasBorder = bwt || bwr || bwb || bwl ||
      el.borderStyle !== DEFAULT_RECT_STYLES.borderStyle ||
      el.borderColor !== DEFAULT_RECT_STYLES.borderColor;
    if (hasBorder) {
      lines.push(`border-width: ${bwt}px ${bwr}px ${bwb}px ${bwl}px;`);
      lines.push(`border-style: ${el.borderStyle};`);
      lines.push(`border-color: ${el.borderColor};`);
    }

    // Text properties (only on text elements, only when set)
    if (el.type === 'text') {
      if (el.fontFamily !== undefined) lines.push(`font-family: ${el.fontFamily};`);
      if (el.fontSize !== undefined) lines.push(`font-size: ${el.fontSize}px;`);
      if (el.fontWeight !== undefined) lines.push(`font-weight: ${el.fontWeight};`);
      if (el.color !== undefined) lines.push(`color: ${el.color};`);
      if (el.textAlign !== undefined) lines.push(`text-align: ${el.textAlign};`);
      if (el.lineHeight !== undefined) lines.push(`line-height: ${el.lineHeight};`);
      if (el.letterSpacing !== undefined) {
        lines.push(`letter-spacing: ${el.letterSpacing}px;`);
      }
    }

    // Position — POC uses absolute positioning within the parent, except
    // when the parent is a flex container, in which case we let the flex
    // layout engine place this element.
    if (!inFlexParent) {
      lines.push(`position: absolute;`);
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
