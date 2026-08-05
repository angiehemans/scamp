import type { ScampElement } from './element';
import { classNameFor, elementDeclarationLines, tagFor } from './generateCode';

/**
 * The live context file Scamp writes to `.scamp/context.md` — the open
 * target and the selected element, in markdown an agent can read at the
 * start of a turn instead of asking the user to describe what they clicked.
 * see docs/plans/live-context-file-plan.md
 */

/** The page or component currently open on the canvas. */
export type ContextTarget = {
  kind: 'page' | 'component';
  name: string;
  /** Project-RELATIVE. Absolute paths would leak the user's home directory
   *  into a file agents quote back verbatim. */
  tsxPath: string;
  cssPath: string;
};

export type ContextInput = {
  target: ContextTarget | null;
  elements: Record<string, ScampElement>;
  /** Selection in panel order — index 0 is the primary. */
  selectedIds: ReadonlyArray<string>;
  canvasWidth: number;
  breakpointLabel: string;
};

const HEADER = `# Scamp Active Context

> This file is updated automatically by Scamp. Do not edit.
> It reflects the current canvas state as of the last interaction.`;

/** Longest text preview shown for a child, before an ellipsis. */
const TEXT_PREVIEW_MAX = 40;

const preview = (raw: string): string => {
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > TEXT_PREVIEW_MAX
    ? `${flat.slice(0, TEXT_PREVIEW_MAX - 1)}…`
    : flat;
};

/** `.root › .body_a1b2 › .card_c3d4` — ancestors, outermost first. */
const parentChain = (
  elements: Record<string, ScampElement>,
  el: ScampElement
): string[] => {
  const chain: string[] = [];
  let cursor = el.parentId ? elements[el.parentId] : undefined;
  // Bounded by the map size so a corrupt parent cycle can't hang the write.
  let guard = Object.keys(elements).length + 1;
  while (cursor && guard > 0) {
    chain.unshift(`.${classNameFor(cursor)}`);
    cursor = cursor.parentId ? elements[cursor.parentId] : undefined;
    guard -= 1;
  }
  return chain;
};

/** One `- .cls (tag) — …` line per direct child. */
const childLine = (child: ScampElement): string => {
  const head = `- .${classNameFor(child)} (${tagFor(child)})`;
  if (child.type === 'text' && typeof child.text === 'string' && child.text.length > 0) {
    return `${head} — "${preview(child.text)}"`;
  }
  if (child.type === 'component-instance') {
    return `${head} — instance of ${child.componentName ?? 'unknown component'}`;
  }
  const count = child.childIds.length;
  if (count === 0) return head;
  return `${head} — ${count} ${count === 1 ? 'child' : 'children'}`;
};

const targetSection = (target: ContextTarget | null): string => {
  if (target === null) {
    return `## Active page\n\nNo project open.`;
  }
  const heading = target.kind === 'component' ? 'Active component' : 'Active page';
  const nameLine =
    target.kind === 'component'
      ? `Component: ${target.name}\n`
      : `Page: ${target.name}\n`;
  return `## ${heading}\n\n${nameLine}File: ${target.tsxPath}\nCSS:  ${target.cssPath}`;
};

const selectionSection = (
  elements: Record<string, ScampElement>,
  el: ScampElement,
  extraSelected: number
): string => {
  const lines = [
    `ID:      ${el.id}`,
    `Class:   .${classNameFor(el)}`,
    `Tag:     ${tagFor(el)}`,
  ];
  // `name` is the user's own label for the element; absent on most.
  if (el.name !== undefined && el.name.length > 0) {
    lines.push(`Name:    ${el.name}`);
  }
  const parent = el.parentId ? elements[el.parentId] : undefined;
  if (parent) lines.push(`Parent:  .${classNameFor(parent)}`);
  const chain = parentChain(elements, el);
  // A flex ancestor is usually the answer to "why does this look wrong", so
  // the chain earns its line even though the brief only asked for children.
  if (chain.length > 0) lines.push(`Chain:   ${chain.join(' › ')}`);
  if (extraSelected > 0) {
    lines.push(
      `\n+${extraSelected} more element${extraSelected === 1 ? '' : 's'} also selected. The details above are for the primary selection.`
    );
  }
  return `## Selected element\n\n${lines.join('\n')}`;
};

const stylesSection = (
  elements: Record<string, ScampElement>,
  el: ScampElement
): string => {
  const parent = el.parentId ? elements[el.parentId] ?? null : null;
  // The generator's own emitter, so the block can't drift from the CSS
  // actually on disk. It skips defaults and appends customProperties, so
  // filter those back out — they get their own section below.
  const custom = new Set(Object.keys(el.customProperties ?? {}));
  const lines = elementDeclarationLines(el, parent).filter((line) => {
    if (line.length === 0) return false;
    const prop = line.slice(0, line.indexOf(':')).trim();
    return !custom.has(prop);
  });
  if (lines.length === 0) {
    // Reachable when every declaration on the element is a custom property
    // — they're listed in their own section rather than repeated here.
    return `## Current styles\n\nNothing set through Scamp's canvas controls.`;
  }
  return `## Current styles\n\n${lines.join('\n')}`;
};

const childrenSection = (
  elements: Record<string, ScampElement>,
  el: ScampElement
): string | null => {
  const children = el.childIds
    .map((id) => elements[id])
    .filter((c): c is ScampElement => c !== undefined);
  if (children.length === 0) return null;
  return `## Children\n\n${children.map(childLine).join('\n')}`;
};

const customSection = (el: ScampElement): string | null => {
  const entries = Object.entries(el.customProperties ?? {});
  if (entries.length === 0) return null;
  return `## Custom properties (not mapped to canvas controls)\n\n${entries
    .map(([prop, value]) => `${prop}: ${value};`)
    .join('\n')}`;
};

/**
 * Render the whole file.
 *
 * Sections that would be empty are omitted rather than emitted with a
 * placeholder — an agent reading "Custom properties: none" learns nothing,
 * while an absent heading is unambiguous.
 */
export const buildContextMarkdown = (input: ContextInput): string => {
  const { target, elements, selectedIds, canvasWidth, breakpointLabel } = input;
  const blocks: string[] = [HEADER, targetSection(target)];

  const primaryId = selectedIds[0];
  const selected = primaryId !== undefined ? elements[primaryId] : undefined;

  if (selected === undefined) {
    blocks.push(`## Selected element\n\nNone selected.`);
  } else {
    blocks.push(
      selectionSection(elements, selected, Math.max(0, selectedIds.length - 1))
    );
    blocks.push(stylesSection(elements, selected));
    const children = childrenSection(elements, selected);
    if (children !== null) blocks.push(children);
    const custom = customSection(selected);
    if (custom !== null) blocks.push(custom);
  }

  blocks.push(
    `## Canvas size\n\n${canvasWidth}px wide / ${breakpointLabel} breakpoint`
  );

  return `${blocks.join('\n\n')}\n`;
};
