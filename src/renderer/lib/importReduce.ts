import {
  CAPTURE_VERSION,
  type CaptureNote,
  type CapturePayload,
  type CapturedNode,
} from '@shared/importCapture';

import { ROOT_ELEMENT_ID, type ElementType, type ScampElement } from './element';
import { makeBaseline, applyDeclarations, applyDeclarationsAsOverride } from './parseCode/apply';
import type { RawDeclaration } from './parseCode/css';
import type { RawElement } from './parseCode/tsx';

/**
 * Reduce a captured page to a Scamp element tree.
 *
 * Pure, and the only new idea in the importer: everything either side
 * of it already exists. Capture is a DOM walk; what comes out the far
 * end goes through `generateCode` unchanged. This is the part that has
 * to decide what a page *means* in a model that is far more
 * constrained than a browser's.
 *
 * Three ideas do most of the work:
 *
 * 1. **A computed value is not a decision.** `width: 442.656px` on a
 *    flexing card is the layout's answer, not the author's. Declaring
 *    it freezes the design. Capture drops the obvious cases; this drops
 *    the ones that need the tree to spot.
 * 2. **A DOM is deeper than a design.** Wrapper elements that carry no
 *    visual decision are removed, conservatively — a redundant div is a
 *    smaller problem than a broken layout.
 * 3. **Nothing is dropped silently.** Everything removed or
 *    unrepresentable becomes a finding, because an import that quietly
 *    loses three icons reads as Scamp being broken.
 *
 * The declaration → typed field mapping is NOT reimplemented here: it
 * reuses `makeBaseline` + `applyDeclarations`, the same pair `parseCode`
 * uses, so an imported element and a hand-written one can't disagree.
 * see docs/plans/website-import-plan.md
 */

export type ImportFindingKind =
  | CaptureNote['kind']
  | 'collapsed-wrapper'
  | 'dropped-computed-size'
  | 'wrapped-bare-text'
  | 'inline-kept'
  | 'block-to-flex'
  | 'breakpoint-captured'
  | 'breakpoint-absent'
  | 'restored-auto-margin'
  | 'unsupported-display';

export type ImportFinding = {
  kind: ImportFindingKind;
  /** Where in the source page, as the capture described it. */
  at?: string;
  detail?: string;
};

export type ImportResult = {
  elements: Record<string, ScampElement>;
  rootId: string;
  /** Everything removed, changed, or impossible — for the import report. */
  findings: ImportFinding[];
  /** A PascalCase view name derived from the page title. */
  suggestedName: string;
  /** Element id → its source node's structural path, for breakpoints. */
  sourcePaths: Record<string, string>;
  /**
   * The declarations each element was built from, kept so a narrower
   * capture can be diffed against what the base actually used rather
   * than against the model's idea of it.
   */
  baseStyles: Record<string, Record<string, string>>;
  /**
   * Element id → the captured node it came from. Recorded rather than
   * inferred: the fidelity harness compares each imported element
   * against its own source box, and matching them by position in the
   * tree guesses wrong the moment anything is collapsed.
   */
  sourceNodes: Record<string, number>;
};

/**
 * Tags that become a text element. Mirrors `parseCode`'s own list —
 * a text element is one whose content is words rather than layout.
 */
const TEXT_TAGS: ReadonlySet<string> = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label',
  'blockquote', 'pre', 'code', 'strong', 'em', 'small', 'time',
  'figcaption', 'legend', 'li', 'button', 'th', 'td', 'caption',
]);

const IMAGE_TAGS: ReadonlySet<string> = new Set(['img', 'video', 'iframe', 'svg']);
const INPUT_TAGS: ReadonlySet<string> = new Set(['input', 'textarea', 'select']);

/**
 * A property that, present on a node, means the node is doing something
 * visible and must not be collapsed away.
 */
const VISUAL_PROPERTIES: ReadonlyArray<string> = [
  'background-color', 'background-image', 'opacity', 'box-shadow', 'filter',
  'backdrop-filter', 'mix-blend-mode', 'transform',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'position', 'z-index', 'overflow-x', 'overflow-y',
  'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
];

/** A display value that means the node is arranging its children. */
const LAYOUT_DISPLAYS: ReadonlySet<string> = new Set([
  'flex', 'inline-flex', 'grid', 'inline-grid',
]);

/**
 * Displays with no equivalent in the model, kept verbatim but reported.
 *
 * `list-item` is deliberately NOT here. It is an ordinary block that
 * also draws a marker, the flow translation handles it like any other
 * block, and Scamp models `list-style` directly — reporting every `<li>`
 * on a page as an unsupported layout was 19 false alarms on one site
 * and buried the real ones.
 */
const UNSUPPORTED_DISPLAYS: ReadonlySet<string> = new Set([
  'table', 'table-row', 'table-cell', 'table-header-group',
  'table-row-group', 'table-footer-group', 'table-column',
  'inline-table', 'contents',
]);

const elementTypeFor = (tag: string): ElementType => {
  if (IMAGE_TAGS.has(tag)) return 'image';
  if (INPUT_TAGS.has(tag)) return 'input';
  return TEXT_TAGS.has(tag) ? 'text' : 'rectangle';
};

/** Displays whose children flow inline rather than stacking. */
const INLINE_DISPLAYS: ReadonlySet<string> = new Set([
  'inline', 'inline-block', 'inline-flex', 'inline-grid', 'inline-table',
]);

/**
 * Give a block container the flex layout that matches how it already
 * behaves, because Scamp has no model for block flow.
 *
 * This is the difference between an import that looks like the page and
 * one that looks like every element piled at the origin. Scamp emits
 * `position: absolute; left: 0; top: 0` for a child of a parent that
 * isn't a layout container — inside a flex or grid parent the child is
 * in flow, and outside one it is pinned. The web's default is block
 * flow, so on a real page MOST containers are neither flex nor grid,
 * and importing them as-is pins nearly everything. Measured on two real
 * sites: 56% and 28% of rules absolutely positioned before this, 4% and
 * 4% after — the rest being genuinely absolute or sticky.
 *
 * Block flow stacking children down the page IS `flex-direction:
 * column` with the default `align-items: stretch`. A container whose
 * children are all inline is the row case. Neither is a perfect
 * translation — floats and inline text wrapping have no equivalent —
 * but both are enormously closer than absolute.
 */
const flowLayoutFor = (node: CapturedNode): Record<string, string> | null => {
  const display = node.styles['display'] ?? 'block';
  if (LAYOUT_DISPLAYS.has(display)) return null;
  if (node.children.length === 0) return null;
  // A text element holds inline content — words that wrap and sit on a
  // baseline. Making it a flex container turns each word-run into a
  // flex item, which loses the wrapping and the line box: a 81x43
  // paragraph came back 304x100.
  if (elementTypeFor(node.tag) === 'text') return null;
  // `inline` on the parent means it is part of a line, not building one.
  if (display === 'inline') return null;
  const childDisplays = node.children.map((c) => c.styles['display'] ?? 'block');
  const allInline = childDisplays.every((d) => INLINE_DISPLAYS.has(d));
  return allInline
    ? { display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'wrap', 'align-items': 'center' }
    : { display: 'flex', 'flex-direction': 'column' };
};


/** Does this node make a visible difference beyond holding its children? */
const isVisuallyMeaningful = (node: CapturedNode): boolean => {
  if (VISUAL_PROPERTIES.some((p) => p in node.styles)) return true;
  if (LAYOUT_DISPLAYS.has(node.styles['display'] ?? '')) return true;
  if (node.text !== null) return true;
  if (Object.keys(node.attrs).length > 0) return true;
  if (node.notes.length > 0) return true;
  return false;
};

/**
 * Remove wrappers that hold exactly one child and decide nothing.
 *
 * Conservative by choice: one child only, and only when the node has no
 * visual property, no layout display, no text, no attributes and no
 * notes. A wrapper that centres its child with flex is doing real work
 * and stays, even though it looks redundant in the layers panel.
 */
const collapse = (
  node: CapturedNode,
  findings: ImportFinding[],
  path: string[],
  /** The view's root is never collapsed away: the tree has to have one. */
  isRoot = false
): CapturedNode => {
  const here = [...path, node.tag];
  let current: CapturedNode = {
    ...node,
    children: node.children.map((c) => collapse(c, findings, here)),
  };
  if (isRoot) return current;
  while (
    current.children.length === 1 &&
    !isVisuallyMeaningful(current) &&
    current.tag === 'div'
  ) {
    const only = current.children[0];
    if (only === undefined) break;
    findings.push({
      kind: 'collapsed-wrapper',
      at: here.join(' > '),
      detail: `<div> around <${only.tag}>`,
    });
    current = only;
  }
  return current;
};

/**
 * Drop a size that the layout produced rather than the author chose.
 *
 * A node with element children is sized by its content and its parent;
 * pinning the measured pixels is how an import turns into a rigid
 * screenshot. A leaf keeps its size, because an image or a spacer with
 * an explicit box is usually the point.
 *
 * This is the conservative reading. The precise answer needs the
 * authored rules rather than the computed ones, which is a phase-2
 * question — see the plan's note on `document.styleSheets`.
 */
/**
 * Drop a size only when the layout would produce it anyway.
 *
 * The first version of this dropped width and height from every element
 * with children, on the principle that a computed value is not a
 * decision. Measured, that cost 20 points of fidelity — 92% of elements
 * within 2px of the source became 72% — because plenty of those widths
 * WERE decisions, and a dropped one becomes a guess.
 *
 * The measured box tells the two apart. An element whose width matches
 * the space its parent gave it was filling, and `stretch` reproduces
 * that at any width; one that is narrower chose to be, and the number
 * has to be kept. Same for height against its content.
 *
 * So the rule is not "prefer flexible" or "prefer faithful" — it is
 * "declare what the page decided, and let flow do the rest".
 */
const dropComputedSizes = (
  node: CapturedNode,
  parentRect: { w: number; h: number } | null,
  findings: ImportFinding[],
  at: string
): { styles: Record<string, string>; dropped: Array<'width' | 'height'> } => {
  const styles = node.styles;
  const rect = node.rect;
  if (node.children.length === 0 || !rect || !parentRect) {
    return { styles, dropped: [] };
  }
  const next = { ...styles };
  const dropped: Array<'width' | 'height'> = [];
  // Within a pixel of the parent's content box: this element was
  // filling, not sizing itself.
  const fills = Math.abs(rect.w - parentRect.w) <= 1;
  if (fills && 'width' in next) {
    findings.push({ kind: 'dropped-computed-size', at, detail: `width: ${next['width']}` });
    delete next['width'];
    dropped.push('width');
  }
  // A height equal to the children's extent is the content's, not a
  // decision; anything else (a min-height, a fixed hero) is kept.
  const childExtent = node.children.reduce(
    (max, c) => (c.rect ? Math.max(max, c.rect.y + c.rect.h - rect.y) : max),
    0
  );
  if (childExtent > 0 && Math.abs(rect.h - childExtent) <= 1 && 'height' in next) {
    findings.push({ kind: 'dropped-computed-size', at, detail: `height: ${next['height']}` });
    delete next['height'];
    dropped.push('height');
  }
  return { styles: next, dropped };
};

/**
 * Properties measured off `document.body` that describe the VIEWPORT
 * rather than the design: the capture was taken at 1440x900, so body
 * reports exactly that. Carrying them onto the view's root pins it to
 * the window the import happened in.
 */
const VIEWPORT_DERIVED: ReadonlyArray<string> = [
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'overflow-x', 'overflow-y',
];

/**
 * `margin: 0 auto` — the centring idiom — computes to equal pixel
 * margins at the captured width. Importing those pins the element to
 * one viewport size, and it is the single most common layout idiom on
 * the web, so getting it wrong is visible on nearly every page.
 *
 * Equal non-zero left and right margins on an element that also has a
 * `max-width` is that idiom with near-certainty: a designer setting
 * literal matching side margins would have no reason to cap the width
 * too.
 */
const restoreAutoMargins = (
  styles: Record<string, string>,
  findings: ImportFinding[],
  at: string
): Record<string, string> => {
  const left = styles['margin-left'];
  const right = styles['margin-right'];
  if (left === undefined || left !== right) return styles;
  if (left === '0px' || !('max-width' in styles)) return styles;
  findings.push({ kind: 'restored-auto-margin', at, detail: left });
  return { ...styles, 'margin-left': 'auto', 'margin-right': 'auto' };
};

/**
 * A captured inline run as the model's `text` + `inlineFragments`.
 *
 * The generator emits a text element as: its `text`, then every
 * fragment whose `afterChildIndex` is -1, in array order. So a leading
 * text run becomes `text` and everything after it becomes fragments,
 * which reproduces the source order exactly.
 */
const inlineToFragments = (
  inline: NonNullable<CapturedNode['inline']>
): { text: string | null; fragments: RawElement['inlineFragments'] } => {
  const items = [...inline];
  let text: string | null = null;
  if (items[0]?.kind === 'text') {
    text = items[0].value.trim();
    items.shift();
  }
  const fragments = items.map((item) =>
    item.kind === 'text'
      ? ({ kind: 'text' as const, value: item.value, afterChildIndex: -1 })
      : ({ kind: 'jsx' as const, source: item.source, afterChildIndex: -1 })
  );
  return { text, fragments };
};

/**
 * The styles an element is built from, after every translation this
 * module makes: block flow becomes flex, centring becomes auto margins,
 * and the root sheds the viewport it was measured in.
 *
 * Shared with the breakpoint diff on purpose, and it is not an
 * optimisation. A narrow capture compared against UNnormalised base
 * styles reports every translation as a difference — most damagingly
 * `display`, where the base reads `flex` (this module put it there) and
 * the narrow capture reads `block`. Scamp models only flex and grid, so
 * `block` lands on its "not a layout container" sentinel, which is the
 * string `none` — and an override of `display: none` is emitted
 * verbatim. The result was every block container on the page
 * disappearing at tablet and mobile: a blank canvas, from a diff that
 * was measuring its own work.
 */
const normalizedStyles = (
  node: CapturedNode,
  isRoot: boolean,
  findings: ImportFinding[],
  at: string
): Record<string, string> => {
  const flow = flowLayoutFor(node);
  if (flow !== null) {
    findings.push({ kind: 'block-to-flex', at, detail: flow['flex-direction'] });
  }
  let styles = flow === null ? node.styles : { ...node.styles, ...flow };
  styles = restoreAutoMargins(styles, findings, at);
  if (isRoot) {
    const rootStyles = { ...styles };
    for (const prop of VIEWPORT_DERIVED) delete rootStyles[prop];
    styles = rootStyles;
  }
  return styles;
};

/** `styles` as the declaration list `applyDeclarations` expects. */
const toDeclarations = (styles: Record<string, string>): RawDeclaration[] =>
  Object.entries(styles).map(([prop, value]) => ({ prop, value }));

/**
 * A readable class prefix from the tag and its role, so the layers
 * panel reads like a design rather than a DOM dump.
 */
const NAME_FOR_TAG: Readonly<Record<string, string>> = {
  nav: 'nav', header: 'header', footer: 'footer', main: 'main',
  section: 'section', article: 'card', aside: 'aside', figure: 'figure',
  ul: 'list', ol: 'list', li: 'item', img: 'image', button: 'button',
  svg: 'icon', video: 'video', iframe: 'embed',
  a: 'link', h1: 'title', h2: 'heading', h3: 'subheading',
  p: 'text', span: 'label', form: 'form', input: 'field',
};

/** PascalCase view name from a page title, falling back to `Imported`. */
export const viewNameFromTitle = (title: string): string => {
  const words = title
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 3);
  if (words.length === 0) return 'Imported';
  const name = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  return /^[0-9]/.test(name) ? `Imported${name}` : name;
};

export type ReduceOptions = {
  /**
   * Id source. Injected so tests get a deterministic sequence, the same
   * approach the tree mutators in `element/tree.ts` take.
   */
  randomId?: () => string;
};

/**
 * Fold captures taken at narrower widths into breakpoint overrides.
 *
 * Pure, and separate from `reduceCapture` on purpose: a base import
 * must not depend on the narrow captures succeeding, and a page whose
 * mobile layout is a different DOM should still import its desktop one.
 *
 * Elements are matched by structural path, never by id — ids are walk
 * order, and a mobile menu appearing shifts every one after it. A path
 * that does not appear at the narrow width means the element is not
 * there, which is not an override but an absence, and Scamp has no way
 * to say "gone below 768px". Those are counted and reported rather than
 * guessed at.
 * see docs/plans/website-import-plan.md
 */
export const applyBreakpointCaptures = (
  base: ImportResult,
  narrower: ReadonlyArray<{ breakpointId: string; payload: CapturePayload }>
): ImportResult => {
  let elements = base.elements;
  const findings = [...base.findings];

  for (const { breakpointId, payload } of narrower) {
    const byPath = new Map<string, CapturedNode>();
    const index = (node: CapturedNode): void => {
      if (node.path !== undefined) byPath.set(node.path, node);
      node.children.forEach(index);
    };
    index(payload.root);

    let changed = 0;
    let absent = 0;
    const next: Record<string, ScampElement> = { ...elements };
    for (const [id, element] of Object.entries(elements)) {
      const path = base.sourcePaths[id];
      if (path === undefined) continue;
      const narrow = byPath.get(path);
      if (narrow === undefined) {
        absent += 1;
        continue;
      }
      // Normalised the same way the base was, or the diff measures this
      // module's own translations rather than the page's media queries.
      const narrowStyles = normalizedStyles(narrow, id === ROOT_ELEMENT_ID, [], '');

      // Only the declarations that actually differ at this width. A
      // width that merely re-measured is not an override — the same
      // "computed value is not a decision" rule as the base capture.
      const declarations: RawDeclaration[] = [];
      for (const [prop, value] of Object.entries(narrowStyles)) {
        if (prop === 'width' || prop === 'height') continue;
        if (baseStyleOf(base, id, prop) === value) continue;
        declarations.push({ prop, value });
      }
      if (declarations.length === 0) continue;

      const override = applyDeclarationsAsOverride(declarations);
      if (Object.keys(override).length === 0) continue;
      next[id] = {
        ...element,
        breakpointOverrides: {
          ...(element.breakpointOverrides ?? {}),
          [breakpointId]: override,
        },
      };
      changed += 1;
    }
    elements = next;
    if (changed > 0) {
      findings.push({
        kind: 'breakpoint-captured',
        at: breakpointId,
        detail: `${changed} elements`,
      });
    }
    if (absent > 0) {
      findings.push({
        kind: 'breakpoint-absent',
        at: breakpointId,
        detail: `${absent} elements`,
      });
    }
  }

  return { ...base, elements, findings };
};

/** The base capture's value for one property on one element. */
const baseStyleOf = (base: ImportResult, id: string, prop: string): string | undefined =>
  base.baseStyles[id]?.[prop];

/** Reduce a captured page to an element tree. Pure. */
export const reduceCapture = (
  payload: CapturePayload,
  options: ReduceOptions = {}
): ImportResult => {
  if (payload.version !== CAPTURE_VERSION) {
    throw new Error(
      `Capture payload is version ${payload.version}; this build reads ${CAPTURE_VERSION}.`
    );
  }

  const findings: ImportFinding[] = [];
  // Capture's own notes come first: they describe the source page, and
  // they are the things Scamp cannot represent at all.
  const collectNotes = (node: CapturedNode): void => {
    for (const note of node.notes) findings.push({ ...note });
    node.children.forEach(collectNotes);
  };
  collectNotes(payload.root);
  for (const note of payload.notes) findings.push({ ...note });

  const pruned = collapse(payload.root, findings, [], true);

  let counter = 0;
  const fallbackId = (): string => {
    counter += 1;
    return counter.toString(16).padStart(4, '0');
  };
  const nextId = options.randomId ?? fallbackId;

  const elements: Record<string, ScampElement> = {};
  const sourceNodes: Record<string, number> = {};
  const sourcePaths: Record<string, string> = {};
  const baseStyles: Record<string, Record<string, string>> = {};
  const used = new Set<string>([ROOT_ELEMENT_ID]);

  const build = (
    node: CapturedNode,
    parentId: string | null,
    path: string[],
    parentIsLayout: boolean,
    /** How the parent arranges this child: down the page, or across it. */
    parentFlow: 'row' | 'column',
    /** The parent's measured box, for telling "filling" from "sized". */
    parentRect: { w: number; h: number } | null
  ): string => {
    const isRoot = parentId === null;
    const type = elementTypeFor(node.tag);
    const at = [...path, node.tag].join(' > ');

    let id = ROOT_ELEMENT_ID;
    if (!isRoot) {
      do {
        id = nextId();
      } while (used.has(id));
      used.add(id);
    }

    const name = isRoot ? null : (NAME_FOR_TAG[node.tag] ?? 'box');
    const className = isRoot ? ROOT_ELEMENT_ID : `${name}_${id}`;

    // Running text with inline markup in it stays one element: the
    // markup becomes fragments rather than boxes. see `inlineToFragments`
    const inlineRun = node.inline ? inlineToFragments(node.inline) : null;
    if (inlineRun !== null) {
      findings.push({
        kind: 'inline-kept',
        at,
        detail: `${node.inline?.length ?? 0} runs`,
      });
    }

    // Scamp's rule: words live in a text element, never loose in a
    // container. A node with both text and element children gets the
    // text lifted into a child of its own.
    const hasElementChildren = node.children.length > 0;
    const needsTextChild = inlineRun === null && node.text !== null && hasElementChildren;

    const sized = dropComputedSizes(node, parentRect, findings, at);
    const styles = normalizedStyles(
      { ...node, styles: sized.styles },
      isRoot,
      findings,
      at
    );
    const display = styles['display'];
    if (display !== undefined && UNSUPPORTED_DISPLAYS.has(display)) {
      findings.push({ kind: 'unsupported-display', at, detail: display });
    }

    const raw: RawElement = {
      id,
      type,
      // `document.body` is the capture's root; a Scamp root is a div.
      tag: isRoot ? 'div' : node.tag,
      className,
      parentId,
      childIds: [],
      text: inlineRun !== null ? inlineRun.text : needsTextChild ? null : node.text,
      inlineFragments: inlineRun !== null ? inlineRun.fragments : [],
      name,
      src: type === 'image' && node.tag === 'img' ? (node.attrs['src'] ?? null) : null,
      alt: type === 'image' && node.tag === 'img' ? (node.attrs['alt'] ?? '') : null,
      attributes: Object.fromEntries(
        Object.entries(node.attrs).filter(
          ([k]) => !(type === 'image' && node.tag === 'img' && (k === 'src' || k === 'alt'))
        )
      ),
      svgSource: node.svgSource ?? null,
      selectOptions: null,
      componentName: null,
      instanceId: null,
      propOverrides: null,
      missingComponent: false,
      bind: null,
      on: null,
      repeat: null,
      showIf: null,
      range: null,
    };

    const baseline = makeBaseline(raw, true);
    const element = applyDeclarations(baseline, toDeclarations(styles), parentIsLayout);
    // A size that was a layout result needs the mode that reproduces how
    // the element got that size, not merely the absence of a number.
    //
    // Width and height are not symmetrical in flow. A block-level
    // element FILLS its container's width and takes its height from its
    // content — so a dropped width becomes `stretch` and a dropped
    // height becomes `auto`. Setting both to `auto` makes every
    // container hug its contents, which measured as a 1200px row
    // arriving 510px wide.
    const autoSized: Partial<ScampElement> = {};
    if (sized.dropped.includes('width')) {
      // Down a column, a child fills the cross axis — that is what
      // `align-items: stretch` does, and what block flow does. Across a
      // row, its width is its content's. Keying this off the element's
      // own display instead measured worse than not doing it at all.
      const display = node.styles['display'] ?? 'block';
      autoSized.widthMode =
        parentFlow === 'row' || INLINE_DISPLAYS.has(display) ? 'auto' : 'stretch';
    }
    if (sized.dropped.includes('height')) autoSized.heightMode = 'auto';

    const selfIsLayoutForText = LAYOUT_DISPLAYS.has(display ?? '');
    // What this element does to ITS children, after the flow rewrite.
    const ownFlow: 'row' | 'column' =
      (styles['flex-direction'] ?? 'row').startsWith('column') ||
      display === 'grid' ||
      display === 'inline-grid'
        ? 'column'
        : 'row';
    const childIds: string[] = [];
    if (needsTextChild) {
      const textId = (() => {
        let candidate = nextId();
        while (used.has(candidate)) candidate = nextId();
        used.add(candidate);
        return candidate;
      })();
      findings.push({ kind: 'wrapped-bare-text', at, detail: node.text ?? '' });
      const textRaw: RawElement = {
        ...raw,
        id: textId,
        type: 'text',
        tag: 'span',
        className: `text_${textId}`,
        parentId: id,
        name: 'text',
        text: node.text,
        src: null,
        alt: null,
        attributes: {},
      };
      elements[textId] = applyDeclarations(makeBaseline(textRaw, true), [], selfIsLayoutForText);
      childIds.push(textId);
    }
    const selfIsLayout = LAYOUT_DISPLAYS.has(display ?? '');
    for (const child of node.children) {
      childIds.push(
        build(child, id, [...path, node.tag], selfIsLayout, ownFlow, node.rect ?? null)
      );
    }

    elements[id] = { ...element, ...autoSized, childIds };
    sourceNodes[id] = node.id;
    if (node.path !== undefined) sourcePaths[id] = node.path;
    baseStyles[id] = styles;
    return id;
  };

  build(pruned, null, [], false, 'column', null);

  return {
    elements,
    rootId: ROOT_ELEMENT_ID,
    findings,
    suggestedName: viewNameFromTitle(payload.title),
    sourceNodes,
    sourcePaths,
    baseStyles,
  };
};
