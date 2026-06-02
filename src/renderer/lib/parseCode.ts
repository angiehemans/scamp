import { Parser } from 'htmlparser2';
import postcss from 'postcss';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from './defaults';
import { getTagDefaultPadding } from './tagDefaults';
import { cssToScampProperty, isMappedProperty } from './cssPropertyMap';
import {
  ELEMENT_STATES,
  ROOT_ELEMENT_ID,
  type BreakpointOverride,
  type ElementStateName,
  type ElementType,
  type KeyframesBlock,
  type PropertyGroup,
  type RawSelectorBlock,
  type ScampElement,
  type SelectOption,
  type StateOverride,
} from './element';
import {
  canonicalizeGroupList,
  isPropertyGroup,
} from './propertyGroups';
import { parseAnimationShorthand, parsePx, parseSpaceValueOrNull } from './parsers';
import { matchesPreset } from './keyframesMatch';
import {
  DEFAULT_BREAKPOINTS,
  DESKTOP_BREAKPOINT_ID,
  type Breakpoint,
} from '@shared/types';

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
  /**
   * Any `@media` blocks the parser couldn't match to a known
   * breakpoint — agent-written `min-width` queries, prefers-color-
   * scheme, orientation, and custom max-widths that aren't in the
   * project config. Preserved verbatim as raw CSS so `generateCode`
   * can re-emit them untouched.
   */
  customMediaBlocks: string[];
  /**
   * `@keyframes` blocks collected from the page, in source order.
   * Travel together at the page level rather than per-element since
   * multiple elements can reference the same keyframe name. The
   * canvas store mirrors this list so `generateCode` can re-emit
   * them on every save.
   */
  keyframesBlocks: KeyframesBlock[];
  /**
   * Per-element list of CSS property names that appeared more than
   * once in the element's base class block. Empty array (or absent
   * key) when no duplicates were seen. The cascade picks last-wins so
   * Scamp's typed state reflects the final declaration; this map lets
   * the UI surface a warning indicator on the affected section so
   * users know the file is in a non-canonical state. Editing any
   * field on the element via the panel triggers the generator to
   * rewrite the class block from typed state, which removes the
   * duplicates.
   *
   * Per-state and per-breakpoint duplicates aren't tracked here yet —
   * they're rarer and the same cleanup path applies (any panel edit
   * collapses them). Future-extensible.
   */
  cssDuplicates: Record<string, ReadonlyArray<string>>;
};

export type ParseCodeOptions = {
  /**
   * The project's breakpoint table. Used to route `@media
   * (max-width: Npx)` declarations into `element.breakpointOverrides`
   * keyed by the matching breakpoint's id. When omitted, defaults
   * are used — handy for tests and for call sites that don't have
   * project config loaded yet.
   */
  breakpoints?: ReadonlyArray<Breakpoint>;
};

/**
 * Return the set of CSS property names that appear more than once in
 * a declaration list. Used to surface a warning indicator in the
 * panel when an agent or hand edit left two `height: …` (or any
 * other property) declarations in the same block.
 *
 * Order is preserved by first appearance so callers that render the
 * list to the user get a stable order.
 */
export const findDuplicateDeclProps = (
  decls: ReadonlyArray<RawDeclaration>
): string[] => {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const { prop } of decls) {
    const seen = counts.get(prop);
    if (seen === undefined) {
      counts.set(prop, 1);
      order.push(prop);
    } else {
      counts.set(prop, seen + 1);
    }
  }
  return order.filter((p) => (counts.get(p) ?? 0) > 1);
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

/**
 * Match a `<group> off` comment-body string (already trimmed and
 * lower-cased) and return the corresponding `PropertyGroup` when
 * the word before `off` is a known group name. Whitespace around
 * the word is tolerated, but the comment text must contain only
 * the label — anything else (e.g. trailing decls) refuses.
 */
const matchGroupLabel = (text: string): PropertyGroup | null => {
  const match = text.trim().toLowerCase().match(/^([a-z]+)\s+off$/);
  if (!match) return null;
  const candidate = match[1];
  if (!candidate || !isPropertyGroup(candidate)) return null;
  return candidate;
};

/**
 * Parse a comment body that LOOKS like a CSS declaration —
 * `<prop>: <value>` (trailing `;` optional) — into a typed
 * `RawDeclaration`. Used inside a toggled-off group block to
 * recover the commented-out typed state. Returns null when the
 * comment isn't shaped like a declaration (e.g. just notes or
 * the group label itself).
 */
const parseCommentAsDeclaration = (text: string): RawDeclaration | null => {
  const trimmed = text.trim();
  // Strip a single trailing `;` if present (the generator emits
  // them; agents may or may not).
  const stripped = trimmed.endsWith(';')
    ? trimmed.slice(0, -1).trimEnd()
    : trimmed;
  const colonIdx = stripped.indexOf(':');
  if (colonIdx < 1) return null;
  const prop = stripped.slice(0, colonIdx).trim();
  const value = stripped.slice(colonIdx + 1).trim();
  if (prop.length === 0 || value.length === 0) return null;
  // CSS property names: letters / digits / dashes, starting with
  // a letter or dash. Rejects free-form prose so we don't try to
  // route arbitrary text comments through cssPropertyMap.
  if (!/^[a-zA-Z-][a-zA-Z0-9-]*$/.test(prop)) return null;
  return { prop, value };
};

/**
 * Walk a rule's nodes manually, collecting both active
 * declarations (`decl`) and commented-out toggled-off-group
 * blocks (`comment` nodes interleaved with the active decls).
 *
 * A `<group> off` label comment (e.g. `shadow off`) opens
 * capture mode for the named group; subsequent `comment` nodes
 * inside the same rule whose bodies parse as `prop: value` get
 * added to `decls` as if active — so the typed values inside
 * the comment block are preserved for round-trip. Toggling the
 * group back ON via the panel promotes them to active
 * declarations.
 *
 * The `toggledOff` array accumulates the group names seen in
 * labels (sorted + deduped by the caller). Element-scoped: a
 * label in any of the element's blocks (base, breakpoint, state)
 * adds the group to the element's `toggledOffGroups`.
 */
const collectRuleNodes = (
  rule: postcss.Rule
): { decls: RawDeclaration[]; toggledOff: PropertyGroup[] } => {
  const decls: RawDeclaration[] = [];
  const toggledOff: PropertyGroup[] = [];
  let captureGroup: PropertyGroup | null = null;
  for (const child of rule.nodes ?? []) {
    if (child.type === 'comment') {
      const text = (child as postcss.Comment).text;
      const label = matchGroupLabel(text);
      if (label) {
        captureGroup = label;
        if (!toggledOff.includes(label)) toggledOff.push(label);
        continue;
      }
      if (captureGroup) {
        const decl = parseCommentAsDeclaration(text);
        if (decl) decls.push(decl);
      }
      continue;
    }
    if (child.type === 'decl') {
      // Any real declaration ends the capture mode — a commented
      // block is a contiguous run terminated by the next active
      // line.
      captureGroup = null;
      decls.push({ prop: child.prop, value: child.value });
    }
  }
  return { decls, toggledOff };
};

type RawElement = {
  id: string;
  type: ElementType;
  /** The HTML tag name as written in the source file. Captured so the
   *  generator can round-trip semantic tags like h1, section, header.
   *  For component instances, this is the PascalCase component name
   *  (recovered from the file's import pre-pass — htmlparser2
   *  lowercases by default). */
  tag: string;
  className: string;
  parentId: string | null;
  childIds: string[];
  text: string | null;
  /**
   * Loose text + unclassed JSX subtrees that appear between this
   * element's child elements (or before/after them). Captured in
   * source order so the generator can emit them verbatim. Pure-
   * whitespace text fragments are dropped to avoid double-spacing
   * generator-emitted indentation.
   */
  inlineFragments: Array<
    | { kind: 'text'; value: string; afterChildIndex: number }
    | { kind: 'jsx'; source: string; afterChildIndex: number }
  >;
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

  // Component-instance fields. Populated only when
  // `type === 'component-instance'`.
  componentName: string | null;
  instanceId: string | null;
  propOverrides: Record<string, string> | null;
  missingComponent: boolean;
};

/**
 * Match `import Pascal from '@/components/Pascal/Pascal';` (or
 * with double quotes; trailing semicolon optional). Used by the
 * import pre-pass to learn which capitalised JSX tags in the
 * source resolve to Scamp components — without this map, the
 * lowercased tag stream from htmlparser2 can't tell `<Button/>`
 * apart from a real `<button>`.
 */
const COMPONENT_IMPORT_RE =
  /import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"]@\/components\/([A-Z][A-Za-z0-9_]*)\/\2['"];?/g;

/**
 * Build a lowercase-tag → PascalCase-component-name map from
 * the page's `import` lines. The lowercase key is what
 * htmlparser2 surfaces in `onopentag`; the value is the
 * original-case name we use for `componentName`.
 *
 * Imports whose imported binding doesn't match the path-component
 * (e.g. `import Btn from '@/components/Button/Button'`) are
 * skipped — Scamp's generator only emits the canonical form, and
 * renaming the binding without renaming the folder would
 * desync component identity from the import.
 */
const scanComponentImports = (tsx: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const match of tsx.matchAll(COMPONENT_IMPORT_RE)) {
    const importedName = match[1];
    const folderName = match[2];
    if (importedName !== folderName) continue;
    out.set(importedName!.toLowerCase(), importedName!);
  }
  return out;
};

const CLASS_NAME_RE = /\{?\s*styles\.([A-Za-z_][A-Za-z0-9_]*)\s*\}?/;

/**
 * Match the destructured props on a component's default-export
 * function — the form generateCode emits for any component with
 * at least one text-prop:
 *
 *   export default function Foo({ label = "Hello" }: FooProps)
 *
 * Captures the contents of the inner `{ … }` so a follow-up pass
 * can extract individual `name = "default"` pairs. Matches greedy
 * stop on the closing `}` — none of the destructured defaults are
 * objects in Scamp's emitted form (all values are plain string
 * literals), so a balanced-brace parser isn't needed.
 *
 * No match → the function has no text-props (or it's a page,
 * which never emits this form). Callers fall back to an empty
 * defaults map.
 */
const COMPONENT_PROPS_DESTRUCTURE_RE =
  /export\s+default\s+function\s+\w+\s*\(\s*\{([^}]*)\}\s*:\s*\w+Props\s*\)/;

/**
 * Match one `name = "literal"` pair inside the destructure block.
 * Identifier syntax matches what the renderer's Data tab allows
 * (lowerCamelCase JS identifier). The string body is captured raw
 * — escape sequences are decoded by `decodeTsStringLiteral`.
 */
const PROPS_DESTRUCTURE_PAIR_RE =
  /([a-z][a-zA-Z0-9_]*)\s*=\s*"((?:\\.|[^"\\])*)"/g;

/**
 * Match a JSX-expression-only text body, ignoring surrounding
 * whitespace from generator indentation. Used to detect when a
 * parsed text element's content is a single `{propName}` ref so
 * we can hydrate it into the typed `prop` field.
 */
const PROP_REF_TEXT_RE = /^\s*\{([a-z][a-zA-Z0-9_]*)\}\s*$/;

/**
 * Reverse of `tsStringLiteral` in generateCode.ts. Decodes the
 * minimal set of escapes the generator emits.
 */
const decodeTsStringLiteral = (raw: string): string =>
  raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

/**
 * Parse the function-signature destructure into a `propName →
 * defaultText` map. Components with no text-props (and pages,
 * which never emit this form) return an empty map. The returned
 * map is the authoritative source for restoring a text element's
 * `text` field after its JSX-expression body resolves to a known
 * prop name.
 */
const parsePropsDestructure = (tsx: string): Map<string, string> => {
  const out = new Map<string, string>();
  const block = tsx.match(COMPONENT_PROPS_DESTRUCTURE_RE);
  if (!block) return out;
  const inner = block[1] ?? '';
  // Iterate with a fresh regex each time — global flags are stateful.
  const pairRe = new RegExp(PROPS_DESTRUCTURE_PAIR_RE.source, 'g');
  for (const m of inner.matchAll(pairRe)) {
    const name = m[1];
    const raw = m[2];
    if (!name) continue;
    out.set(name, decodeTsStringLiteral(raw ?? ''));
  }
  return out;
};

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
  // Resolve lowercased JSX tag names back to their imported
  // PascalCase form (htmlparser2 lowercases tags). Pages that
  // don't use any components get an empty map; the
  // component-instance recognition path naturally skips for those.
  const componentImports = scanComponentImports(tsx);

  // Parallel to every onopentag event, regardless of whether we
  // pushed a RawElement onto `stack`. Lets onclosetag know whether to
  // pop the real stack or skip.
  type FrameKind = 'pushed' | 'skipped' | 'svg-inner' | 'option';
  const frames: FrameKind[] = [];

  // Depth of nested unclassed (skipped) tags currently open inside
  // a Scamp parent. When > 0, we treat text + nested tags as part of
  // the verbatim JSX fragment — only capture once we close the
  // OUTERMOST skipped tag so e.g. `<strong>a <em>b</em></strong>`
  // round-trips byte-equivalent.
  let skippedDepth = 0;
  let skippedRootStart = 0;

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

        // Component instance: a JSX tag carrying
        // `data-scamp-instance-id`. The tag name we see here is
        // lowercased (htmlparser2 default), so we recover the
        // PascalCase component name via the import pre-pass. A
        // matching `import` confirms the reference; otherwise the
        // element still parses but is flagged as
        // `missingComponent` so the renderer can surface an error
        // placeholder.
        const rawInstanceId = attribs['data-scamp-instance-id'];
        if (typeof rawInstanceId === 'string' && rawInstanceId.length > 0) {
          const resolvedName = componentImports.get(name);
          const componentName = resolvedName ?? name;
          const parentId =
            stack.length > 0 ? stack[stack.length - 1]!.id : null;
          // Use the instanceId itself as the canvas element id —
          // these need to be unique across the page anyway, and
          // reusing it keeps debugging simple. (For very old
          // `data-scamp-instance-id="inst_a1b2"` we strip the
          // `inst_` prefix; the canvas id is the hex tail.)
          const id = rawInstanceId.includes('_')
            ? rawInstanceId.slice(rawInstanceId.lastIndexOf('_') + 1)
            : rawInstanceId;
          // Every attribute other than the instance id is treated
          // as a prop override. Empty-string values are kept (an
          // explicit "render empty" override is distinct from
          // absence). React-specific attributes that don't follow
          // PascalCase prop conventions (e.g. `className`,
          // `style`) round-trip through `propOverrides` too — we
          // don't model styling on instances in Phase 1.
          const propOverrides: Record<string, string> = {};
          for (const [attrName, attrValue] of Object.entries(attribs)) {
            if (attrName === 'data-scamp-instance-id') continue;
            propOverrides[attrName] = attrValue;
          }
          const el: RawElement = {
            id,
            type: 'component-instance',
            tag: componentName,
            className: '',
            parentId,
            childIds: [],
            text: null,
            inlineFragments: [],
            name: null,
            src: null,
            alt: null,
            attributes: {},
            svgSource: null,
            selectOptions: null,
            componentName,
            instanceId: rawInstanceId,
            propOverrides,
            missingComponent: resolvedName === undefined,
          };
          if (parentId) {
            const parent = byId.get(parentId);
            parent?.childIds.push(id);
          }
          elements.push(el);
          byId.set(id, el);
          stack.push(el);
          frames.push('pushed');
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
          inlineFragments: [],
          name: parsedName,
          src: typedImgSrcAlt ? (attribs['src'] ?? null) : null,
          alt: typedImgSrcAlt ? (attribs['alt'] ?? null) : null,
          attributes: extraAttributes,
          svgSource: null,
          selectOptions: null,
          // Component-instance fields default empty/null on
          // regular elements; only set on the component-instance
          // branch above.
          componentName: null,
          instanceId: null,
          propOverrides: null,
          missingComponent: false,
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
        // Inside an unclassed JSX subtree — text is part of the
        // verbatim source captured on close.
        if (skippedDepth > 0) return;
        const top = stack[stack.length - 1];
        if (!top) return;
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
        if (text.trim().length === 0) return;
        top.inlineFragments.push({
          kind: 'text',
          value: text,
          afterChildIndex: top.childIds.length - 1,
        });
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
        if (frame === 'skipped') {
          skippedDepth -= 1;
          // Just closed the OUTERMOST skipped tag inside a Scamp
          // parent — slice its verbatim source out of the original
          // tsx and push as an inline JSX fragment on that parent.
          if (skippedDepth === 0 && stack.length > 0) {
            const closeEnd = (parser.endIndex ?? skippedRootStart) + 1;
            const source = tsx.slice(skippedRootStart, closeEnd);
            const top = stack[stack.length - 1]!;
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
        // Structural correction for ambiguous tags. Some HTML tags
        // (e.g. `<li>`, `<a>`, `<label>`) can semantically be either
        // a text node or a container. `inferElementType` defaults
        // them to `text` based on the tag name, which is right for
        // a leaf like `<li>Item</li>` but wrong for the much more
        // common `<li><span>...</span><span>...</span></li>` —
        // text-typed elements only render their `.text` content and
        // ignore Scamp children, so the inner spans visually
        // disappear on the canvas. When we close one of these
        // elements and it ended up with Scamp children, upgrade it
        // to a rectangle so its children render. Only applies when
        // the className prefix didn't pin the type explicitly (a
        // `text_` prefix is honored regardless).
        if (
          top &&
          top.type === 'text' &&
          top.childIds.length > 0 &&
          !top.className.startsWith('text_')
        ) {
          top.type = 'rectangle';
        }
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

type ParsedCss = {
  /** Base (non-@media) declarations keyed by class name. */
  byClass: ClassDeclarations;
  /**
   * Property groups toggled off for each class, union'd across
   * any blocks (base / breakpoint / state) where a label
   * appeared. Element-scoped: the consumer overlays this onto
   * `element.toggledOffGroups`.
   */
  toggledOffByClass: Map<string, PropertyGroup[]>;
  /**
   * `@media (max-width: Npx)` declarations whose N matches a known
   * breakpoint's width. Outer key is breakpoint id; inner key is
   * class name. Populated when the parser can route an @media block
   * to a known breakpoint.
   */
  byBreakpoint: Map<string, ClassDeclarations>;
  /**
   * Per-state declarations for the recognised pseudo-classes
   * (`:hover`, `:active`, `:focus`). Outer key is state name; inner
   * key is class name. Compound or unrecognised pseudo-class
   * selectors are stored in `rawByClass` instead.
   */
  byState: Map<ElementStateName, ClassDeclarations>;
  /**
   * Pseudo-class blocks the parser couldn't route to a recognised
   * state (`.foo:focus-visible`, `.foo:nth-child(odd)`,
   * `.foo:hover .child`, etc.). Keyed by the bare class name so the
   * blocks travel with the matching element. Order within the array
   * matches the source order so re-emit stays text-stable.
   */
  rawByClass: Map<string, RawSelectorBlock[]>;
  /**
   * Raw CSS text of @media blocks the parser couldn't route — either
   * the query shape isn't `(max-width: Npx)` or the width doesn't
   * match any known breakpoint. Preserved verbatim for round-trip.
   */
  customMediaBlocks: string[];
  /**
   * `@keyframes` blocks collected from the page, in source order.
   * Multiple elements can reference the same keyframe name; the
   * blocks travel together at the page level rather than per-element.
   */
  keyframesBlocks: KeyframesBlock[];
};

/**
 * Inspect a top-level rule selector and decide what bucket it belongs
 * in:
 *   - `base` — plain `.<className>` rule, declarations apply to the
 *     element's top-level fields.
 *   - `state` — `.<className>:hover`, `:active`, or `:focus` exactly.
 *     Routed into the per-state override bucket.
 *   - `raw` — anything else that starts with `.<className>`
 *     (compound, descendant, unrecognised pseudo-class) — preserved
 *     verbatim on the element so the generator can re-emit it.
 *   - `null` — selector isn't class-prefixed; not Scamp's concern.
 */
type SelectorClassification =
  | { kind: 'base'; className: string }
  | { kind: 'state'; className: string; state: ElementStateName }
  | { kind: 'raw'; className: string };

const SUPPORTED_STATES: ReadonlyMap<string, ElementStateName> = new Map(
  ELEMENT_STATES.map((s) => [`:${s}`, s])
);

const classifyClassSelector = (
  selector: string
): SelectorClassification | null => {
  if (!selector.startsWith('.')) return null;
  // Capture the leading class name (CSS identifier, allowing `_`,
  // `-`, digits after the first char). Anything after is `rest`.
  const match = selector.match(/^\.([A-Za-z_][\w-]*)([\s\S]*)$/);
  if (!match) return null;
  const className = match[1] ?? '';
  const rest = (match[2] ?? '').trim();
  if (rest.length === 0) return { kind: 'base', className };
  const stateMatch = SUPPORTED_STATES.get(rest);
  if (stateMatch !== undefined) {
    return { kind: 'state', className, state: stateMatch };
  }
  return { kind: 'raw', className };
};

/** Extract a numeric max-width from a media query condition like
 *  `(max-width: 768px)`. Returns null for anything else so we don't
 *  silently mis-route min-width, orientation, or complex queries. */
const parseMaxWidthParam = (params: string): number | null => {
  const match = params
    .trim()
    .match(/^\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
};

/**
 * Parse a CSS module file into class-keyed declarations plus any
 * `@media` declarations the parser can route to a known breakpoint.
 * Unrecognised @media blocks are preserved verbatim so the generator
 * can re-emit them untouched on round-trip.
 */
const parseCssDeclarations = (
  css: string,
  breakpoints: ReadonlyArray<Breakpoint>
): ParsedCss => {
  const byClass: ClassDeclarations = new Map();
  const byBreakpoint = new Map<string, ClassDeclarations>();
  const byState = new Map<ElementStateName, ClassDeclarations>();
  const rawByClass = new Map<string, RawSelectorBlock[]>();
  const customMediaBlocks: string[] = [];
  const keyframesBlocks: KeyframesBlock[] = [];
  const toggledOffByClass = new Map<string, PropertyGroup[]>();

  /** Merge a freshly-parsed `toggledOff` list into the union map. */
  const mergeToggledOff = (
    className: string,
    groups: ReadonlyArray<PropertyGroup>
  ): void => {
    if (groups.length === 0) return;
    const existing = toggledOffByClass.get(className) ?? [];
    toggledOffByClass.set(className, canonicalizeGroupList([...existing, ...groups]) as PropertyGroup[]);
  };

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return {
      byClass,
      byBreakpoint,
      byState,
      rawByClass,
      customMediaBlocks,
      keyframesBlocks,
      toggledOffByClass,
    };
  }

  // Walk top-level rules first — these are the base class blocks
  // and per-state pseudo-class blocks. Using direct iteration (not
  // walkRules) so we skip rules nested inside @media; those get
  // handled in the at-rule walk below.
  for (const node of root.nodes) {
    if (node.type !== 'rule') continue;
    const selector = node.selector.trim();
    const classification = classifyClassSelector(selector);
    if (classification === null) continue;

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

    const { decls, toggledOff } = collectRuleNodes(node);
    mergeToggledOff(classification.className, toggledOff);

    if (classification.kind === 'base') {
      byClass.set(classification.className, decls);
    } else {
      // state
      const bucket =
        byState.get(classification.state) ?? new Map<string, RawDeclaration[]>();
      bucket.set(classification.className, decls);
      byState.set(classification.state, bucket);
    }
  }

  // Walk top-level @media at-rules. Route known (max-width: Npx)
  // queries into the breakpoint bucket; stash everything else as
  // raw CSS for verbatim re-emit.
  const widthToId = new Map<number, string>();
  for (const bp of breakpoints) {
    if (bp.id === DESKTOP_BREAKPOINT_ID) continue;
    widthToId.set(bp.width, bp.id);
  }

  for (const node of root.nodes) {
    if (node.type !== 'atrule') continue;
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
      if (c === null) return;
      if (c.kind !== 'base') hasNonBaseRule = true;
      rule.walkDecls((decl) => {
        if (decl.prop === 'animation') hasAnimationDecl = true;
      });
    });
    if (hasNonBaseRule || hasAnimationDecl) {
      customMediaBlocks.push(node.toString());
      continue;
    }
    // Extract per-class declarations inside this @media. Same
    // toggled-off-group treatment as the base/state walk: a
    // label inside a breakpoint scope counts toward the
    // element-level `toggledOffGroups`, and commented decls
    // inside parse into the breakpoint's typed override.
    const bucket = byBreakpoint.get(bpId) ?? new Map<string, RawDeclaration[]>();
    node.walkRules((rule) => {
      const c = classifyClassSelector(rule.selector.trim());
      if (c === null || c.kind !== 'base') return;
      const { decls, toggledOff } = collectRuleNodes(rule);
      mergeToggledOff(c.className, toggledOff);
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
    toggledOffByClass,
  };
};

/**
 * Apply a list of declarations as a breakpoint override. Unlike
 * `applyDeclarations` (which overlays onto a full element baseline
 * and returns a full element), this returns a Partial carrying just
 * the fields the declarations touch — the right shape for
 * `element.breakpointOverrides[bpId]`.
 */
const applyDeclarationsAsOverride = (
  decls: RawDeclaration[]
): BreakpointOverride => {
  let override: BreakpointOverride = {};
  const customProperties: Record<string, string> = {};

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
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = override.margin ?? [0, 0, 0, 0];
      override = { ...override, margin: [sv, m[1], m[2], m[3]] };
      continue;
    }
    if (prop === 'margin-right') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = override.margin ?? [0, 0, 0, 0];
      override = { ...override, margin: [m[0], sv, m[2], m[3]] };
      continue;
    }
    if (prop === 'margin-bottom') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = override.margin ?? [0, 0, 0, 0];
      override = { ...override, margin: [m[0], m[1], sv, m[3]] };
      continue;
    }
    if (prop === 'margin-left') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = override.margin ?? [0, 0, 0, 0];
      override = { ...override, margin: [m[0], m[1], m[2], sv] };
      continue;
    }
    if (isMappedProperty(prop)) {
      const mapper = cssToScampProperty[prop]!;
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
const applyDeclarationsAsStateOverride = (
  decls: RawDeclaration[]
): StateOverride => {
  const base = applyDeclarationsAsOverride(decls);
  const animDecl = decls.find((d) => d.prop === 'animation');
  if (!animDecl) return base;
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
  const out: StateOverride = { ...base, animation: parsed };
  if (Object.keys(cleanedCustom).length > 0) {
    out.customProperties = cleanedCustom;
  } else {
    delete out.customProperties;
  }
  return out;
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
  inlineFragments: [],
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
  // Apply UA-padding-aware tag defaults so a file with no `padding`
  // declaration on a `<ul>` parses to the UA-equivalent
  // `[0, 0, 0, 40]` — matching what the browser renders. Without
  // this, the canvas would model `<ul>` as zero-padding (parser
  // default) and the next regen would have to add a `padding: 0`
  // line every save, dirtying the file just to keep state coherent.
  const tagPadding = isRoot ? defaults.padding : getTagDefaultPadding(raw.tag);
  return {
    ...defaults,
    padding: [...tagPadding] as [number, number, number, number],
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
    // `tag` field and the generator emits a `<div>` again. Component
    // instances skip this entirely — their identity is `componentName`,
    // not a Scamp `tag` override.
    ...(raw.type !== 'component-instance' && raw.tag !== defaultTagForType(raw.type)
      ? { tag: raw.tag }
      : {}),
    ...(raw.name !== null ? { name: raw.name } : {}),
    ...(raw.src !== null ? { src: raw.src } : {}),
    ...(raw.alt !== null ? { alt: raw.alt } : {}),
    // Only store the attribute bag when non-empty so round-trips stay
    // text-stable: an element with no extra attrs parses with no
    // `attributes` field.
    ...(Object.keys(raw.attributes).length > 0 ? { attributes: raw.attributes } : {}),
    ...(raw.svgSource !== null ? { svgSource: raw.svgSource } : {}),
    ...(raw.selectOptions !== null ? { selectOptions: raw.selectOptions } : {}),
    // Component-instance carry-through. Identity lives in
    // `componentName` + `instanceId`; overrides land in
    // `propOverrides`. `missingComponent` only emitted when true so
    // round-trips stay text-stable for well-resolved instances.
    ...(raw.type === 'component-instance'
      ? {
          componentName: raw.componentName ?? raw.tag,
          instanceId: raw.instanceId ?? raw.id,
          propOverrides: raw.propOverrides ?? {},
          ...(raw.missingComponent ? { missingComponent: true } : {}),
        }
      : {}),
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
    // `parseSpaceValueOrNull` accepts px and `var(--token)`; anything
    // else (rem, %, auto) falls through to customProperties so it
    // round-trips verbatim.
    if (prop === 'margin-top') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = element.margin;
      element = { ...element, margin: [sv, m[1], m[2], m[3]] };
      continue;
    }
    if (prop === 'margin-right') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = element.margin;
      element = { ...element, margin: [m[0], sv, m[2], m[3]] };
      continue;
    }
    if (prop === 'margin-bottom') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = element.margin;
      element = { ...element, margin: [m[0], m[1], sv, m[3]] };
      continue;
    }
    if (prop === 'margin-left') {
      const sv = parseSpaceValueOrNull(value);
      if (sv === null) {
        customProperties[prop] = value;
        continue;
      }
      const m = element.margin;
      element = { ...element, margin: [m[0], m[1], m[2], sv] };
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
        if (v === 'absolute') continue;
        if (v === 'relative' && element.id === ROOT_ELEMENT_ID) continue;
      }
      const mapper = cssToScampProperty[prop]!;
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

export const parseCode = (
  tsx: string,
  css: string,
  options?: ParseCodeOptions
): ParsedTree => {
  const breakpoints = options?.breakpoints ?? DEFAULT_BREAKPOINTS;
  const rawElements = parseTsxStructure(tsx);
  const parsedCss = parseCssDeclarations(css, breakpoints);
  const elements: Record<string, ScampElement> = {};
  const cssDuplicates: Record<string, ReadonlyArray<string>> = {};
  // Map of `propName → defaultText` extracted from the component's
  // function destructure (empty for pages, which never emit a
  // `[Name]Props` destructure). Used in the post-pass to hydrate
  // each text element whose body resolves to `{propName}` back
  // into a typed `prop` field.
  const propDefaults = parsePropsDestructure(tsx);

  // Always start with a root, even if the TSX is missing one. Downstream
  // code (canvas store, ProjectShell) assumes ROOT_ELEMENT_ID exists.
  let rootSeen = false;
  let migrated = false;

  for (const raw of rawElements) {
    const isRoot = raw.id === ROOT_ELEMENT_ID;
    if (isRoot) rootSeen = true;

    const baseline = makeBaseline(raw);
    let decls = parsedCss.byClass.get(raw.className) ?? [];
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
    let finalElement: ScampElement = isRoot
      ? applied
      : {
          ...applied,
          widthMode: hasWidth ? applied.widthMode : 'auto',
          heightMode: hasHeight ? applied.heightMode : 'auto',
        };

    // Fold in any breakpoint overrides for this element's class.
    const overrides: Record<string, BreakpointOverride> = {};
    for (const bp of breakpoints) {
      if (bp.id === DESKTOP_BREAKPOINT_ID) continue;
      const classesForBp = parsedCss.byBreakpoint.get(bp.id);
      if (!classesForBp) continue;
      const bpDecls = classesForBp.get(raw.className);
      if (!bpDecls || bpDecls.length === 0) continue;
      const override = applyDeclarationsAsOverride(bpDecls);
      if (Object.keys(override).length > 0) overrides[bp.id] = override;
    }
    if (Object.keys(overrides).length > 0) {
      finalElement = { ...finalElement, breakpointOverrides: overrides };
    }

    // Fold in per-state overrides for this element's class. Uses
    // `applyDeclarationsAsStateOverride` (which wraps the breakpoint
    // helper) so per-state animations parse into the typed
    // `animation` field instead of falling through to
    // customProperties.
    const stateOverrides: Partial<Record<ElementStateName, StateOverride>> = {};
    for (const state of ELEMENT_STATES) {
      const classesForState = parsedCss.byState.get(state);
      if (!classesForState) continue;
      const stateDecls = classesForState.get(raw.className);
      if (!stateDecls || stateDecls.length === 0) continue;
      const override = applyDeclarationsAsStateOverride(stateDecls);
      if (Object.keys(override).length > 0) stateOverrides[state] = override;
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

    // Element-scoped property-group toggles. Any group labelled as
    // off in any rule (base / state / breakpoint) is treated as off
    // for the whole element — same surface the user toggles in the
    // panel. `toggledOffByClass` is already canonicalised.
    const toggledOff = parsedCss.toggledOffByClass.get(raw.className);
    if (toggledOff && toggledOff.length > 0) {
      finalElement = {
        ...finalElement,
        toggledOffGroups: toggledOff,
      };
    }

    elements[raw.id] = finalElement;

    // Track duplicates in the BASE class block. State / breakpoint
    // duplicates are deferred — same cleanup path applies (any panel
    // edit on the element rewrites all rule blocks for it from typed
    // state) but the indicator surface is rarer there.
    const dupes = findDuplicateDeclProps(decls);
    if (dupes.length > 0) cssDuplicates[raw.id] = dupes;
  }

  if (!rootSeen) {
    elements[ROOT_ELEMENT_ID] = makeRoot();
  }

  // Post-pass: hydrate component text-props. When a text element's
  // captured body is a single `{propName}` JSX expression AND the
  // function signature declared a default for that prop, set the
  // typed `prop` field and restore `text` to the destructure
  // default. Unresolved `{whatever}` expressions stay as literal
  // text so user-/agent-written JSX round-trips byte-stably.
  if (propDefaults.size > 0) {
    for (const id of Object.keys(elements)) {
      const el = elements[id];
      if (!el || el.type !== 'text') continue;
      const text = el.text;
      if (typeof text !== 'string') continue;
      const m = text.match(PROP_REF_TEXT_RE);
      if (!m) continue;
      const propName = m[1]!;
      if (!propDefaults.has(propName)) continue;
      elements[id] = {
        ...el,
        prop: propName,
        text: propDefaults.get(propName) ?? '',
      };
    }
  }

  return {
    elements,
    rootId: ROOT_ELEMENT_ID,
    customMediaBlocks: parsedCss.customMediaBlocks,
    keyframesBlocks: parsedCss.keyframesBlocks,
    cssDuplicates,
    ...(migrated ? { migrated: true } : {}),
  };
};
