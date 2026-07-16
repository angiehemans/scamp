import { parseCode } from './parseCode';
import type { ScampElement } from './element';
import type { PageFile } from '@shared/types';

// Cross-page component-usage queries. see docs/notes/components-multi-file-ops.md

type ComponentTree = {
  elements: Record<string, ScampElement>;
  rootId: string;
};

const collectTransitiveComponentNames = (
  componentTrees: Record<string, ComponentTree>,
  startName: string,
  visited: Set<string>
): void => {
  if (visited.has(startName)) return;
  visited.add(startName);
  const tree = componentTrees[startName];
  if (!tree) return;
  for (const el of Object.values(tree.elements)) {
    if (el.type !== 'component-instance') continue;
    const childName = el.componentName;
    if (!childName) continue;
    collectTransitiveComponentNames(componentTrees, childName, visited);
  }
};

/** True iff placing `draggedName` inside `targetName` (the active component editor) would form a cycle. */
export const wouldCreateComponentCycle = (
  componentTrees: Record<string, ComponentTree>,
  targetName: string | null,
  draggedName: string
): boolean => {
  if (!targetName) return false;
  if (draggedName === targetName) return true;
  const visited = new Set<string>();
  collectTransitiveComponentNames(componentTrees, draggedName, visited);
  return visited.has(targetName);
};

export type InstanceUsage = {
  pageName: string;
  instanceCanvasId: string;
  propOverrides: Record<string, string>;
};

/** Walk every page parsing for instances of `componentName`. */
export const findInstanceUsagesAcrossPages = (
  pages: ReadonlyArray<PageFile>,
  componentName: string
): InstanceUsage[] => {
  const out: InstanceUsage[] = [];
  for (const page of pages) {
    let parsed;
    try {
      parsed = parseCode(page.tsxContent, page.cssContent);
    } catch {
      // Skip malformed pages; warning under-reports rather than throws.
      continue;
    }
    for (const el of Object.values(parsed.elements)) {
      if (el.type !== 'component-instance') continue;
      if (el.componentName !== componentName) continue;
      out.push({
        pageName: page.name,
        instanceCanvasId: el.id,
        propOverrides: el.propOverrides ?? {},
      });
    }
  }
  return out;
};

/**
 * Instances of `componentName` (across pages) that have page content filling
 * the given slot. Used to warn before a slot is removed or renamed in the
 * component editor: that content stops rendering (it stays in the page file
 * until re-placed). `slotName` is the component-side slot name; the default
 * slot is `children` and matches content carrying no explicit `slotName` tag.
 * see docs/notes/components-multi-file-ops.md
 */
export const findInstancesWithSlotContent = (
  pages: ReadonlyArray<PageFile>,
  componentName: string,
  slotName: string
): InstanceUsage[] => {
  const out: InstanceUsage[] = [];
  for (const page of pages) {
    let parsed;
    try {
      parsed = parseCode(page.tsxContent, page.cssContent);
    } catch {
      // Skip malformed pages; warning under-reports rather than throws.
      continue;
    }
    for (const el of Object.values(parsed.elements)) {
      if (el.type !== 'component-instance') continue;
      if (el.componentName !== componentName) continue;
      const hasContent = el.childIds.some((cid) => {
        const child = parsed.elements[cid];
        if (!child) return false;
        const effective =
          typeof child.slotName === 'string' && child.slotName.length > 0
            ? child.slotName
            : 'children';
        return effective === slotName;
      });
      if (hasContent) {
        out.push({
          pageName: page.name,
          instanceCanvasId: el.id,
          propOverrides: el.propOverrides ?? {},
        });
      }
    }
  }
  return out;
};

/** Keep only usages whose `propOverrides` map has the named key. */
export const filterUsagesWithPropOverride = (
  usages: ReadonlyArray<InstanceUsage>,
  propName: string
): InstanceUsage[] =>
  usages.filter((u) =>
    Object.prototype.hasOwnProperty.call(u.propOverrides, propName)
  );

/** Roll up usages into per-page counts in source-page order. */
export const groupUsagesByPage = (
  usages: ReadonlyArray<InstanceUsage>
): Array<{ pageName: string; count: number }> => {
  const map = new Map<string, number>();
  for (const u of usages) {
    map.set(u.pageName, (map.get(u.pageName) ?? 0) + 1);
  }
  return [...map.entries()].map(([pageName, count]) => ({ pageName, count }));
};
