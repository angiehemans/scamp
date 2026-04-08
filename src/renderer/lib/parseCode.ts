import { Parser } from 'htmlparser2';
import postcss from 'postcss';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import { cssToScampProperty, isMappedProperty } from './cssPropertyMap';
import { ROOT_ELEMENT_ID, type ScampElement } from './element';
import { parsePx } from './parsers';

/**
 * Pure function: real TSX + CSS module text → canvas state.
 *
 * Inverse of `generateCode`. Reads no external state. Always returns a
 * tree rooted at ROOT_ELEMENT_ID — if the input file is missing or
 * malformed, the result is a tree containing only an empty root.
 */

export type ParsedTree = {
  elements: Record<string, ScampElement>;
  rootId: string;
};

type RawDeclaration = { prop: string; value: string };

type ClassDeclarations = Map<string, RawDeclaration[]>;

type RawElement = {
  id: string;
  type: 'rectangle' | 'text';
  /** The HTML tag name as written in the source file. Captured so the
   *  generator can round-trip semantic tags like h1, section, header. */
  tag: string;
  className: string;
  parentId: string | null;
  childIds: string[];
  text: string | null;
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
]);

/**
 * Decide whether an element is a text or a rectangle. The PRD's contract
 * (and `agent.md`) says the source of truth is the className prefix
 * (`rect_xxxx` vs `text_xxxx`), not the HTML tag, because hand-written
 * or agent-written files often use `<div>` for both. Fall back to the
 * tag name only when the className doesn't match the convention (e.g.
 * the special `root` class).
 */
const inferElementType = (
  className: string,
  tagName: string
): 'rectangle' | 'text' => {
  if (className.startsWith('text_')) return 'text';
  if (className.startsWith('rect_')) return 'rectangle';
  return TEXT_TAGS.has(tagName) ? 'text' : 'rectangle';
};

/**
 * Walk the TSX with htmlparser2 and produce the element tree shape (no
 * styles yet — those come from the CSS pass). We rely on the strict format
 * generateCode emits, so we don't need a real JSX parser:
 *
 *   <div data-scamp-id="..." className={styles.X}>...</div>
 *   <p   data-scamp-id="..." className={styles.X}>text</p>
 */
const parseTsxStructure = (tsx: string): RawElement[] => {
  const elements: RawElement[] = [];
  const stack: RawElement[] = [];
  const byId = new Map<string, RawElement>();

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const id = attribs['data-scamp-id'];
        if (typeof id !== 'string' || id.length === 0) return;
        const classRaw = attribs['classname'] ?? '';
        const match = classRaw.match(CLASS_NAME_RE);
        const className = match?.[1] ?? '';
        const type = inferElementType(className, name);
        const parentId = stack.length > 0 ? stack[stack.length - 1]!.id : null;
        const el: RawElement = {
          id,
          type,
          tag: name,
          className,
          parentId,
          childIds: [],
          text: null,
        };
        if (parentId) {
          const parent = byId.get(parentId);
          parent?.childIds.push(id);
        }
        elements.push(el);
        byId.set(id, el);
        stack.push(el);
      },
      ontext(text) {
        const top = stack[stack.length - 1];
        if (!top || top.type !== 'text') return;
        // Concatenate raw chunks; htmlparser2 may emit multiple ontext
        // events around an entity boundary. We trim outer whitespace once
        // when reading the field, not here, so internal spaces survive.
        top.text = (top.text ?? '') + text;
      },
      onclosetag() {
        stack.pop();
      },
    },
    {
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      decodeEntities: true,
      // Generated TSX uses self-closing syntax for empty elements (`<div />`).
      // div isn't a void element in HTML so we have to opt in here.
      recognizeSelfClosing: true,
    }
  );
  parser.write(tsx);
  parser.end();
  return elements;
};

/**
 * Parse a CSS module file into a class-name → declarations map. Uses
 * postcss so multi-line values, comments, and unusual whitespace round-trip
 * cleanly.
 */
const parseCssDeclarations = (css: string): ClassDeclarations => {
  const map: ClassDeclarations = new Map();
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return map;
  }
  root.walkRules((rule) => {
    // Only handle simple `.classname` selectors. Anything else is
    // unsupported in scamp output and we leave it alone.
    const selector = rule.selector.trim();
    if (!selector.startsWith('.')) return;
    const className = selector.slice(1);
    const decls: RawDeclaration[] = [];
    rule.walkDecls((decl) => {
      decls.push({ prop: decl.prop, value: decl.value });
    });
    // Last rule wins if a class is duplicated.
    map.set(className, decls);
  });
  return map;
};

const makeRoot = (): ScampElement => ({
  ...DEFAULT_ROOT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds: [],
  widthMode: 'fixed',
  heightMode: 'fixed',
  x: 0,
  y: 0,
  customProperties: {},
});

/** The HTML tag we'd default to for an element of this type. Used to
 *  decide whether the parsed `tag` is the default (and can be omitted)
 *  or a deliberate semantic override (and should be stored). */
const defaultTagForType = (type: 'rectangle' | 'text'): string =>
  type === 'text' ? 'p' : 'div';

const makeBaseline = (raw: RawElement): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: raw.id,
  type: raw.type,
  parentId: raw.parentId,
  childIds: [...raw.childIds],
  x: 0,
  y: 0,
  customProperties: {},
  ...(raw.type === 'text' && raw.text !== null ? { text: raw.text.trim() } : {}),
  // Only store an explicit tag when it's NOT the type's default. Keeps
  // the round-trip text-stable: a `<div>` rectangle parses with no
  // `tag` field and the generator emits a `<div>` again.
  ...(raw.tag !== defaultTagForType(raw.type) ? { tag: raw.tag } : {}),
});

/**
 * Apply a list of declarations to an element. Returns a new element with
 * mapped properties applied and unmapped ones stored verbatim in
 * customProperties.
 *
 * Position properties (`position`, `left`, `top`) are handled inline since
 * they affect element fields that aren't in cssToScampProperty.
 */
const applyDeclarations = (
  baseline: ScampElement,
  decls: RawDeclaration[]
): ScampElement => {
  let element: ScampElement = baseline;
  const customProperties: Record<string, string> = {};

  for (const { prop, value } of decls) {
    if (prop === 'position') continue; // structural, not a canvas field
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
    if (isMappedProperty(prop)) {
      const mapper = cssToScampProperty[prop]!;
      const delta = mapper(value);
      element = { ...element, ...delta };
      continue;
    }
    customProperties[prop] = value;
  }

  return { ...element, customProperties };
};

export const parseCode = (tsx: string, css: string): ParsedTree => {
  const rawElements = parseTsxStructure(tsx);
  const declarationsByClass = parseCssDeclarations(css);
  const elements: Record<string, ScampElement> = {};

  // Always start with a root, even if the TSX is missing one. Downstream
  // code (canvas store, ProjectShell) assumes ROOT_ELEMENT_ID exists.
  let rootSeen = false;

  for (const raw of rawElements) {
    if (raw.id === ROOT_ELEMENT_ID) {
      rootSeen = true;
      const baseline = makeRoot();
      // Root supports the same mapped properties as any other element
      // (background, flex container props, padding, border, etc.) so the
      // user can edit page-level styles in the panel. We just skip the
      // position/left/top fields that don't make sense for the page frame.
      // Also: rewrite `min-height` declarations to `height` so the shared
      // declarations applier picks them up via the existing height
      // mapper. The generator emits `min-height` for the page frame
      // because we want pages to grow vertically with content.
      const decls = (declarationsByClass.get('root') ?? []).map((d) =>
        d.prop === 'min-height' ? { prop: 'height', value: d.value } : d
      );
      const next = applyDeclarations(baseline, decls);
      elements[ROOT_ELEMENT_ID] = {
        ...next,
        childIds: [...raw.childIds],
      };
      continue;
    }

    const baseline = makeBaseline(raw);
    const decls = declarationsByClass.get(raw.className) ?? [];
    const applied = applyDeclarations(baseline, decls);

    // If the file didn't actually declare a width or a height for this
    // element, treat the dimension as `auto` (no rendering hint, no
    // generator output). Without this we'd silently default to the
    // 100×100 rect baseline, which makes hand-written / agent-written
    // files render at the wrong size.
    const hasWidth = decls.some((d) => d.prop === 'width');
    const hasHeight = decls.some((d) => d.prop === 'height');
    elements[raw.id] = {
      ...applied,
      widthMode: hasWidth ? applied.widthMode : 'auto',
      heightMode: hasHeight ? applied.heightMode : 'auto',
    };
  }

  if (!rootSeen) {
    elements[ROOT_ELEMENT_ID] = makeRoot();
  }

  return { elements, rootId: ROOT_ELEMENT_ID };
};
