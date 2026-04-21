import { Parser } from 'htmlparser2';
import postcss from 'postcss';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import { cssToScampProperty, isMappedProperty } from './cssPropertyMap';
import {
  ROOT_ELEMENT_ID,
  type ElementType,
  type ScampElement,
  type SelectOption,
} from './element';
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
  /**
   * True when the parser detected the legacy root-sizing three-tuple
   * (`width: Npx` + `min-height: Mpx` + `position: relative`) and
   * stripped it so the new stretch/auto defaults apply. Used by the
   * UI to show a one-time migration banner. Idempotent: once the
   * root's CSS is rewritten without the old three-tuple, subsequent
   * parses return `false`.
   */
  migrated?: boolean;
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
const stripLegacyRootSizing = (
  decls: ReadonlyArray<RawDeclaration>
): { decls: RawDeclaration[]; migrated: boolean } => {
  const widthIdx = decls.findIndex((d) => d.prop === 'width');
  const minHeightIdx = decls.findIndex((d) => d.prop === 'min-height');
  const positionIdx = decls.findIndex(
    (d) => d.prop === 'position' && d.value.trim() === 'relative'
  );
  if (widthIdx < 0 || minHeightIdx < 0 || positionIdx < 0) {
    return { decls: [...decls], migrated: false };
  }
  // Width must be a bare `<N>px` value — anything else (percentages,
  // var() references, calc()) means the user customised it.
  const widthOk = /^\s*\d+(?:\.\d+)?px\s*$/.test(decls[widthIdx]!.value);
  const minHeightOk = /^\s*\d+(?:\.\d+)?px\s*$/.test(decls[minHeightIdx]!.value);
  if (!widthOk || !minHeightOk) {
    return { decls: [...decls], migrated: false };
  }
  // Any additional size-related declaration means this isn't the
  // exact legacy three-tuple — don't touch it.
  const hasOtherSize = decls.some(
    (d) =>
      d.prop === 'height' ||
      d.prop === 'max-width' ||
      d.prop === 'max-height' ||
      d.prop === 'min-width'
  );
  if (hasOtherSize) {
    return { decls: [...decls], migrated: false };
  }
  const stripped = decls.filter(
    (_, i) => i !== widthIdx && i !== minHeightIdx && i !== positionIdx
  );
  return { decls: stripped, migrated: true };
};

type RawDeclaration = { prop: string; value: string };

type ClassDeclarations = Map<string, RawDeclaration[]>;

type RawElement = {
  id: string;
  type: ElementType;
  /** The HTML tag name as written in the source file. Captured so the
   *  generator can round-trip semantic tags like h1, section, header. */
  tag: string;
  className: string;
  parentId: string | null;
  childIds: string[];
  text: string | null;
  /** Human-readable name from `data-scamp-name`, if present. */
  name: string | null;
  /** Image src attribute, if present. */
  src: string | null;
  /** Image alt attribute, if present. */
  alt: string | null;
  /** Every attribute other than the ones typed above, preserved
   *  verbatim so round-trips don't discard agent-written extras. */
  attributes: Record<string, string>;
  /** Verbatim inner source of an `<svg>` element — the substring
   *  between the opening tag's `>` and the closing `</svg>`. */
  svgSource: string | null;
  /** Options collected from `<select>` child `<option>` elements. */
  selectOptions: SelectOption[] | null;
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
const inferElementType = (className: string, tagName: string): ElementType => {
  if (className.startsWith('img_')) return 'image';
  if (className.startsWith('text_')) return 'text';
  if (className.startsWith('input_')) return 'input';
  if (className.startsWith('rect_')) return 'rectangle';
  if (tagName === 'img') return 'image';
  if (INPUT_TAGS.has(tagName)) return 'input';
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
const parseTsxStructure = (tsx: string): RawElement[] => {
  const elements: RawElement[] = [];
  const stack: RawElement[] = [];
  const byId = new Map<string, RawElement>();

  // Parallel to every onopentag event, regardless of whether we
  // pushed a RawElement onto `stack`. Lets onclosetag know whether to
  // pop the real stack or skip.
  type FrameKind = 'pushed' | 'skipped' | 'svg-inner' | 'option';
  const frames: FrameKind[] = [];

  // When capturing an svg's verbatim inner source.
  let svgTarget: RawElement | null = null;
  let svgInnerStart = 0;

  // When inside a `<select>` element, we collect its `<option>`
  // children into the typed list rather than as normal RawElements.
  let selectTarget: RawElement | null = null;
  let currentOption: {
    value: string;
    label: string;
    selected: boolean;
  } | null = null;

  const parser = new Parser(
    {
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
          frames.push('skipped');
          return;
        }

        // data-scamp-id is either the full class name (`sidebar_a1b2`,
        // `rect_a1b2`) or, for backward compat with older projects, the
        // short 4-char hex id (`a1b2`). Extract the short id in both cases.
        const id =
          rawId === ROOT_ELEMENT_ID
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
        const parentId = stack.length > 0 ? stack[stack.length - 1]!.id : null;

        // Derive the custom name from the class name prefix. If the
        // prefix is one of the defaults, the element has no custom name.
        let parsedName: string | null = null;
        if (className.includes('_') && rawId !== ROOT_ELEMENT_ID) {
          const prefix = className.slice(0, className.lastIndexOf('_'));
          if (
            prefix !== 'rect' &&
            prefix !== 'text' &&
            prefix !== 'img' &&
            prefix !== 'input'
          ) {
            parsedName = prefix;
          }
        }

        // Typed src/alt only apply when the tag is actually `<img>` —
        // video/iframe/svg and other image-family tags carry their
        // tag-specific attributes through the generic bag.
        const typedImgSrcAlt = type === 'image' && name === 'img';

        // Collect every attribute not already typed-captured into the
        // generic bag. Preserves unknown attrs verbatim.
        const extraAttributes: Record<string, string> = {};
        for (const [attrName, attrValue] of Object.entries(attribs)) {
          if (attrName === 'data-scamp-id') continue;
          if (attrName === 'className' || attrName === 'classname') continue;
          if (typedImgSrcAlt && (attrName === 'src' || attrName === 'alt')) continue;
          extraAttributes[attrName] = attrValue;
        }

        const el: RawElement = {
          id,
          type,
          tag: name,
          className,
          parentId,
          childIds: [],
          text: null,
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
        } else if (name === 'select') {
          selectTarget = el;
          el.selectOptions = [];
        }
      },
      ontext(text) {
        if (svgTarget) return; // inner source captured wholesale on close
        if (currentOption) {
          currentOption.label += text;
          return;
        }
        const top = stack[stack.length - 1];
        if (!top || top.type !== 'text') return;
        // Concatenate raw chunks; htmlparser2 may emit multiple ontext
        // events around an entity boundary. We trim outer whitespace
        // once when reading the field, not here, so internal spaces
        // survive.
        top.text = (top.text ?? '') + text;
      },
      onclosetag(name) {
        const frame = frames.pop();
        if (frame === 'svg-inner') return;
        if (frame === 'option') {
          if (!currentOption) return;
          const label = currentOption.label.trim();
          const entry: SelectOption = {
            value: currentOption.value,
            label,
          };
          if (currentOption.selected) entry.selected = true;
          if (selectTarget?.selectOptions) {
            selectTarget.selectOptions.push(entry);
          }
          currentOption = null;
          return;
        }
        if (frame === 'skipped') return;
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
    },
    {
      lowerCaseTags: true,
      // Preserve attribute case so React-idiomatic attributes like
      // `htmlFor` and `tabIndex` round-trip unchanged.
      lowerCaseAttributeNames: false,
      decodeEntities: true,
      // Generated TSX uses self-closing syntax for empty elements
      // (`<div />`). div isn't a void element in HTML so we have to
      // opt in here.
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
  x: 0,
  y: 0,
  customProperties: {},
});

/** The HTML tag we'd default to for an element of this type. Used to
 *  decide whether the parsed `tag` is the default (and can be omitted)
 *  or a deliberate semantic override (and should be stored). */
const defaultTagForType = (type: ElementType): string => {
  if (type === 'image') return 'img';
  if (type === 'input') return 'input';
  return type === 'text' ? 'p' : 'div';
};

const makeBaseline = (raw: RawElement): ScampElement => {
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
  let migrated = false;

  for (const raw of rawElements) {
    const isRoot = raw.id === ROOT_ELEMENT_ID;
    if (isRoot) rootSeen = true;

    const baseline = makeBaseline(raw);
    let decls = declarationsByClass.get(raw.className) ?? [];
    if (isRoot) {
      // Detect and strip the legacy three-tuple (pre-canvas-rework)
      // so the new stretch/auto defaults take over. Leaves any other
      // declarations the user wrote intact.
      const result = stripLegacyRootSizing(decls);
      decls = result.decls;
      if (result.migrated) migrated = true;
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
    const finalElement = isRoot
      ? applied
      : {
          ...applied,
          widthMode: hasWidth ? applied.widthMode : 'auto',
          heightMode: hasHeight ? applied.heightMode : 'auto',
        };
    elements[raw.id] = finalElement;
  }

  if (!rootSeen) {
    elements[ROOT_ELEMENT_ID] = makeRoot();
  }

  return { elements, rootId: ROOT_ELEMENT_ID, ...(migrated ? { migrated: true } : {}) };
};
