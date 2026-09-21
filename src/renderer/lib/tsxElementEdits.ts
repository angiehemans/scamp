/**
 * Edits anchored to the element they are about.
 *
 * Phase 3 rewrites whole regions: change one word of text and the
 * component function is replaced with the generated one, so a
 * multi-line opening tag or an unusual indentation someone chose is
 * lost. With `parseCode` reporting a range per element (phase 5), an
 * edit can address the element instead — its opening tag, or the text
 * between its tags — and everything around it stays exactly as
 * written.
 *
 * This only ever narrows. It returns null whenever it cannot explain
 * the difference between two files in terms of individual elements —
 * an element added or removed, a tree reshaped, a change to the props
 * type — and the caller falls back to the region path.
 *
 * see docs/plans/incremental-writes-plan.md, phase 5
 */
import type { ScampElement } from './element';
import type { SourceRange } from './parseCode/tsx';
import type { TextEdit } from './textEdits';
import { findTsxRegions, narrowEdit, tsxRegionChanges } from './tsxRegions';

export type EditSide = {
  text: string;
  elements: Record<string, ScampElement>;
  ranges: Record<string, SourceRange>;
};

/** Fields that live between an element's tags rather than in them. */
const INNER_FIELDS = new Set(['text', 'prop', 'inlineFragments']);

const differingFields = (a: ScampElement, b: ScampElement): string[] => {
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].filter(
    (key) => JSON.stringify(left[key]) !== JSON.stringify(right[key])
  );
};

/**
 * The edits that bring `base` in line with `next`, one per changed
 * element. Empty means the two files describe the same design and the
 * component needs no edit at all — which is the common case for a file
 * Scamp did not write, where the text differs everywhere and the
 * design differs nowhere. Null means the difference is not
 * element-shaped and the caller should fall back.
 */
export const elementEdits = (base: EditSide, next: EditSide): TextEdit[] | null => {
  const ids = Object.keys(next.elements);
  if (ids.length !== Object.keys(base.elements).length) return null;

  const edits: TextEdit[] = [];
  for (const id of ids) {
    const baseElement = base.elements[id];
    const nextElement = next.elements[id];
    if (baseElement === undefined || nextElement === undefined) return null;

    const fields = differingFields(baseElement, nextElement);
    if (fields.length === 0) continue;
    // A reshaped tree is not something a per-element edit can say.
    if (fields.includes('childIds') || fields.includes('parentId')) return null;

    const baseRange = base.ranges[id];
    const nextRange = next.ranges[id];
    if (baseRange === undefined || nextRange === undefined) return null;

    const innerOnly = fields.every((field) => INNER_FIELDS.has(field));
    const isLeaf = nextElement.childIds.length === 0;
    if (!innerOnly) {
      edits.push({
        start: baseRange.start,
        end: baseRange.openEnd,
        replacement: next.text.slice(nextRange.start, nextRange.openEnd),
      });
    }
    if (fields.some((field) => INNER_FIELDS.has(field))) {
      // Rewriting the inside of a container would take its children's
      // formatting with it, which is the thing this exists to avoid.
      if (!isLeaf) return null;
      edits.push({
        start: baseRange.openEnd,
        end: baseRange.innerEnd,
        replacement: next.text.slice(nextRange.openEnd, nextRange.innerEnd),
      });
    }
  }
  edits.sort((a, b) => a.start - b.start);
  for (let i = 1; i < edits.length; i += 1) {
    const previous = edits[i - 1];
    const current = edits[i];
    if (previous === undefined || current === undefined) return null;
    if (current.start < previous.end) return null;
  }
  return edits;
};

/**
 * A save's edits with the component region's rewrite replaced by
 * element-anchored ones. Everything outside the component is still
 * region work — the props type and the imports are not elements — so
 * this is the region path with a finer middle.
 *
 * Null means the difference was not element-shaped, and the caller
 * should use `tsxEdits`. The result is still verified before it is
 * written: a change the elements cannot account for, such as an added
 * prop reaching the destructure, parses differently and falls back.
 */
export const tsxSurgicalEdits = (base: EditSide, next: EditSide): TextEdit[] | null => {
  const elements = elementEdits(base, next);
  if (elements === null) return null;

  const component = findTsxRegions(base.text).find((r) => r.kind === 'component');
  const nextComponent = findTsxRegions(next.text).find((r) => r.kind === 'component');
  if (component === undefined || nextComponent === undefined) return null;
  // Not the same component: the region path emits a removal and an
  // insertion rather than one replacement, and skipping "the component
  // edit" would drop only half of that. Nothing here can patch one
  // file into a different one.
  if (component.key !== nextComponent.key) return null;
  if (elements.some((e) => e.start < component.start || e.end > component.end)) {
    return null;
  }

  const out: TextEdit[] = [];
  let replacedComponent = false;
  for (const edit of tsxRegionChanges(base.text, next.text)) {
    if (edit.start === component.start && edit.end === component.end) {
      replacedComponent = true;
      continue;
    }
    out.push(...narrowEdit(base.text, edit));
  }
  // Elements changed but the component region did not: the two views
  // of the file disagree, so take neither. The reverse — the region's
  // text differs while every element matches — is the whole point:
  // formatting is not a change, so the component is left alone.
  if (elements.length > 0 && !replacedComponent) return null;

  return [...out, ...elements].sort((a, b) => a.start - b.start || a.end - b.end);
};
