import { generateCode } from './generateCode';
import { ROOT_ELEMENT_ID, type ScampElement } from './element';
import type { Breakpoint } from '@shared/types';

/**
 * Extract one element and its descendants from a page's element
 * map into a standalone elements map suitable for
 * `generateCode`. The subtree's original root element keeps its
 * fields but is renamed to `ROOT_ELEMENT_ID` and its `parentId`
 * is cleared — the result reads as a fresh single-root tree
 * matching what `parseCode` produces for a freshly-loaded
 * component file.
 *
 * Returns `null` when the subtree root doesn't exist in
 * `elements` (defensive — callers should always pass a valid id
 * since this fires from a UI selection).
 */
export const extractSubtreeAsComponent = (
  elements: Record<string, ScampElement>,
  subtreeRootId: string
): { elements: Record<string, ScampElement>; rootId: string } | null => {
  const subtreeRoot = elements[subtreeRootId];
  if (!subtreeRoot) return null;

  // Collect every id reachable from the subtree root.
  const idsInSubtree: string[] = [];
  const walk = (id: string): void => {
    const el = elements[id];
    if (!el) return;
    idsInSubtree.push(id);
    for (const childId of el.childIds) walk(childId);
  };
  walk(subtreeRootId);

  // Build the new map.
  // - The subtree root → id becomes `ROOT_ELEMENT_ID`, parentId
  //   becomes null (it's now the top of its own tree).
  // - Direct children of the subtree root → parentId remapped
  //   from `subtreeRootId` to `ROOT_ELEMENT_ID`.
  // - Everything deeper → kept verbatim (their parentIds point
  //   at ids that aren't being remapped).
  // The subtree root's `childIds` also need each entry remapped
  // — but children's ids aren't changed, only the root's. So the
  // ids stay the same; we just need to make sure the new root
  // has the same `childIds` as the old root.
  const newElements: Record<string, ScampElement> = {};
  for (const id of idsInSubtree) {
    const old = elements[id];
    if (!old) continue;
    if (id === subtreeRootId) {
      newElements[ROOT_ELEMENT_ID] = {
        ...old,
        id: ROOT_ELEMENT_ID,
        parentId: null,
        // Drop any `name` — the new root represents the
        // component itself, which doesn't need a class-prefix
        // custom name (the file name IS its identity).
        name: undefined,
      };
    } else {
      const newParentId =
        old.parentId === subtreeRootId ? ROOT_ELEMENT_ID : old.parentId;
      newElements[id] = { ...old, parentId: newParentId };
    }
  }
  return { elements: newElements, rootId: ROOT_ELEMENT_ID };
};

/**
 * Generate the TSX + CSS module file content for a new component
 * whose body is a copy of the named subtree from a page's element
 * tree. Used by the convert-to-component flow.
 *
 * `componentName` becomes both the function name in the generated
 * TSX (via `generateCode`'s `pageName` arg) AND the CSS-module
 * import basename (`import styles from './<Name>.module.css';`).
 *
 * Returns `null` when the subtree root doesn't exist.
 */
export const generateComponentFromSubtree = (
  elements: Record<string, ScampElement>,
  subtreeRootId: string,
  componentName: string,
  breakpoints?: ReadonlyArray<Breakpoint>
): { tsx: string; css: string } | null => {
  const extracted = extractSubtreeAsComponent(elements, subtreeRootId);
  if (!extracted) return null;
  return generateCode({
    elements: extracted.elements,
    rootId: extracted.rootId,
    pageName: componentName,
    breakpoints,
    cssModuleImportName: componentName,
    isComponent: true,
  });
};
