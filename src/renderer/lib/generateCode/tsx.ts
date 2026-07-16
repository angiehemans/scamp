// generateCode/tsx.ts — split out of generateCode.ts (4.5).
import { type ScampElement } from "../element";
import { classNameFor, tagFor } from "./internal";

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


const indent = (level: number): string => '  '.repeat(level);


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
  level: number,
  isComponent: boolean
): string => {
  // Component instances render as their own PascalCase JSX tag,
  // self-closing, carrying `data-scamp-instance-id` + one
  // attribute per prop override. They never have classNames, page
  // children, or text — the visible content lives inside the
  // component definition's own files. The matching `import` is
  // emitted at the top of the page TSX by `collectComponentImports`.
  if (el.type === 'component-instance') {
    const tagName = el.componentName ?? 'Unknown';
    const attrs: string[] = [
      `data-scamp-instance-id="${escapeHtml(el.instanceId ?? '')}"`,
    ];
    const overrides = el.propOverrides ?? {};
    for (const [propName, value] of Object.entries(overrides)) {
      attrs.push(`${propName}="${escapeHtml(value)}"`);
    }
    // Group slot content: the default (`children`) slot emits as JSX
    // children of the tag; named slots emit as `slotName={<…>}` props
    // (a `<>…</>` fragment when more than one element fills the slot).
    // see docs/plans/component-slots-plan.md
    const defaultChildren: ScampElement[] = [];
    const namedSlots = new Map<string, ScampElement[]>();
    for (const childId of el.childIds) {
      const child = elements[childId];
      if (!child) continue;
      const name =
        child.slotName && child.slotName.length > 0 && child.slotName !== 'children'
          ? child.slotName
          : null;
      if (name === null) {
        defaultChildren.push(child);
      } else {
        const arr = namedSlots.get(name) ?? [];
        arr.push(child);
        namedSlots.set(name, arr);
      }
    }
    for (const [name, children] of namedSlots) {
      const inner = children
        .map((c) => renderJsx(c, elements, level + 1, isComponent))
        .join('\n');
      const value =
        children.length === 1
          ? inner.trim()
          : `<>\n${inner}\n${indent(level + 1)}</>`;
      attrs.push(`${name}={${value}}`);
    }

    const openTag = `<${tagName} ${attrs.join(' ')}`;
    if (defaultChildren.length === 0) {
      return `${indent(level)}${openTag} />`;
    }
    const childLines = defaultChildren
      .map((child) => renderJsx(child, elements, level + 1, isComponent))
      .filter((line) => line.length > 0)
      .join('\n');
    return `${indent(level)}${openTag}>\n${childLines}\n${indent(level)}</${tagName}>`;
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

  // Component slot: a slot-marked rectangle emits `{slotName}` — the page
  // instance's children fill it. Its own def-children aren't emitted
  // ("Make slot" is forbidden on a rectangle that has children). see
  // docs/plans/component-slots-plan.md
  const slotRef =
    isComponent && el.slot !== undefined && el.slot.length > 0
      ? el.slot
      : null;
  if (slotRef !== null) {
    return `${indent(level)}${open}>{${slotRef}}</${tag}>`;
  }

  // Components emit `{propName}` for text elements whose `prop` is
  // set — the literal value moves to the function-signature default.
  // Pages render the literal directly because the prop concept
  // doesn't exist there.
  const propRef =
    el.type === 'text' && isComponent && el.prop !== undefined && el.prop.length > 0
      ? el.prop
      : null;
  const hasText =
    propRef !== null ||
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
  const fragmentsAt = (idx: number): string =>
    fragments
      .filter((f) => f.afterChildIndex === idx)
      .map((f) => {
        const text = f.kind === 'text' ? escapeHtml(f.value) : f.source;
        return `${indent(level + 1)}${text}`;
      })
      .join('\n');

  const segments: string[] = [];
  if (hasText) {
    const body = propRef !== null ? `{${propRef}}` : escapeHtml(el.text ?? '');
    segments.push(`${indent(level + 1)}${body}`);
  }
  const before = fragmentsAt(-1);
  if (before.length > 0) segments.push(before);
  el.childIds.forEach((childId, i) => {
    const child = elements[childId];
    if (child) {
      const line = renderJsx(child, elements, level + 1, isComponent);
      if (line.length > 0) segments.push(line);
    }
    const after = fragmentsAt(i);
    if (after.length > 0) segments.push(after);
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
const collectComponentImports = (
  elements: Record<string, ScampElement>
): string[] => {
  const names = new Set<string>();
  for (const el of Object.values(elements)) {
    if (el.type !== 'component-instance') continue;
    const name = el.componentName;
    if (name && name.length > 0) names.add(name);
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
const collectTextProps = (
  elements: Record<string, ScampElement>,
  rootId: string
): ReadonlyArray<{ name: string; defaultText: string }> => {
  const seen = new Set<string>();
  const out: { name: string; defaultText: string }[] = [];
  const walk = (id: string): void => {
    const el = elements[id];
    if (!el) return;
    if (
      el.type === 'text' &&
      typeof el.prop === 'string' &&
      el.prop.length > 0 &&
      !seen.has(el.prop)
    ) {
      seen.add(el.prop);
      out.push({ name: el.prop, defaultText: el.text ?? '' });
    }
    for (const childId of el.childIds) walk(childId);
  };
  walk(rootId);
  return out;
};


/**
 * Walk the element tree from `rootId` collecting every slot name declared
 * on a container rectangle (`el.slot`). One entry per unique name in
 * document order. Each becomes a `name?: React.ReactNode` prop.
 */
const collectSlots = (
  elements: Record<string, ScampElement>,
  rootId: string
): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (id: string): void => {
    const el = elements[id];
    if (!el) return;
    if (
      typeof el.slot === 'string' &&
      el.slot.length > 0 &&
      !seen.has(el.slot)
    ) {
      seen.add(el.slot);
      out.push(el.slot);
    }
    for (const childId of el.childIds) walk(childId);
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
const tsStringLiteral = (raw: string): string => {
  const escaped = raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `"${escaped}"`;
};


export const generateTsx = (
  elements: Record<string, ScampElement>,
  rootId: string,
  pageName: string,
  cssModuleImportName: string,
  isComponent: boolean
): string => {
  const root = elements[rootId];
  const componentName = componentNameFromPage(pageName);
  const stylesImport = `import styles from './${cssModuleImportName}.module.css';`;
  // Component imports follow the styles import, one per
  // referenced component. The path uses the `@/` alias so the
  // resolution works both inside Scamp's canvas iframe and in a
  // user's `next dev` run.
  const componentImports = collectComponentImports(elements).map(
    (name) => `import ${name} from '@/components/${name}/${name}';`
  );
  const importLines = [stylesImport, ...componentImports].join('\n');

  // Props emission (component-only). When the component has at
  // least one text-prop, emit `type [Name]Props = { … }` before
  // the function and destructure with defaults in the signature.
  // No props or page → use the existing no-args signature.
  // Props emission combines text props (`name?: string`, with a default in
  // the destructure) and slots (`name?: React.ReactNode`, no default). Text
  // props are listed first, then slots — both in document order — so the
  // output is stable across saves. see docs/plans/component-slots-plan.md
  const textProps = isComponent ? collectTextProps(elements, rootId) : [];
  const slots = isComponent ? collectSlots(elements, rootId) : [];
  const hasProps = textProps.length > 0 || slots.length > 0;
  const propsTypeName = `${componentName}Props`;
  const typeLines = [
    ...textProps.map((p) => `  ${p.name}?: string;`),
    ...slots.map((name) => `  ${name}?: React.ReactNode;`),
  ];
  const propsTypeBlock = hasProps
    ? `type ${propsTypeName} = {\n${typeLines.join('\n')}\n};\n\n`
    : '';
  const signatureParts = [
    ...textProps.map((p) => `${p.name} = ${tsStringLiteral(p.defaultText)}`),
    ...slots,
  ];
  const signatureArgs = hasProps
    ? `{ ${signatureParts.join(', ')} }: ${propsTypeName}`
    : '';

  if (!root) {
    return `${importLines}\n\n${propsTypeBlock}export default function ${componentName}(${signatureArgs}) {\n  return null;\n}\n`;
  }
  const body = renderJsx(root, elements, 2, isComponent);
  return `${importLines}\n\n${propsTypeBlock}export default function ${componentName}(${signatureArgs}) {\n  return (\n${body}\n  );\n}\n`;
};

