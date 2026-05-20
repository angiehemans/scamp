import { generateCode } from './generateCode';
import { parseCode } from './parseCode';
import type { ScampElement } from './element';
import type { Breakpoint } from '@shared/types';

/**
 * Phase 7.2 — Component rename helpers. Pure functions over
 * TSX/CSS pairs so the orchestrating flow in `ProjectShell` can
 * test them and run them without IPC side effects.
 *
 * Two surfaces need rewriting on a rename:
 *   1. The component file itself: function name, `[Name]Props`
 *      type, and the `import styles from './<Name>.module.css'`
 *      path. Achieved by parsing then regenerating with the new
 *      `pageName` + `cssModuleImportName`.
 *   2. Each page that imports the component: the `import` line,
 *      every `<Old ... />` JSX tag, and the matching
 *      `component-instance` element's `componentName` field.
 *      Achieved the same way — parse, update `componentName` on
 *      matching elements, regenerate.
 */

type RewriteOptions = {
  /** Breakpoint list for the regenerated CSS @media blocks. */
  breakpoints?: ReadonlyArray<Breakpoint>;
};

/**
 * Rewrite a component file (its TSX + CSS) so the function
 * name, Props type name, and CSS module import basename all
 * use `newName` instead of `oldName`. The element tree itself
 * is unchanged — only the surrounding scaffolding flips.
 *
 * `oldName` is unused but kept in the signature for symmetry
 * with `rewritePageForComponentRename` and for self-documenting
 * call sites.
 */
export const rewriteComponentForRename = (
  tsx: string,
  css: string,
  // oldName is unused — the regenerator only needs the new name.
  // Kept for call-site symmetry.
  _oldName: string,
  newName: string,
  options?: RewriteOptions
): { tsx: string; css: string } => {
  const parsed = parseCode(tsx, css, { breakpoints: options?.breakpoints });
  return generateCode({
    elements: parsed.elements,
    rootId: parsed.rootId,
    pageName: newName,
    breakpoints: options?.breakpoints,
    customMediaBlocks: parsed.customMediaBlocks,
    pageKeyframesBlocks: parsed.keyframesBlocks,
    cssModuleImportName: newName,
    isComponent: true,
  });
};

/**
 * Rewrite a page so every instance of `oldName` becomes an
 * instance of `newName`. The page's `import` line and every
 * `<Old ... />` JSX tag flip automatically because
 * `generateCode` derives both from the post-mutation element
 * map's `componentName` field.
 *
 * Returns `changed: false` when the page doesn't reference
 * `oldName` so the caller can skip the disk write — keeping
 * untouched pages free of canonicalisation churn (which would
 * otherwise rewrite their files with the latest generator
 * output and dirty git on every rename).
 *
 * `cssModuleImportName` is derived from `format`: nextjs pages
 * import `./page.module.css`; legacy pages import their own
 * `<pageName>.module.css`.
 */
export const rewritePageForComponentRename = (
  tsx: string,
  css: string,
  oldName: string,
  newName: string,
  pageName: string,
  format: 'legacy' | 'nextjs',
  options?: RewriteOptions
): { tsx: string; css: string; changed: boolean } => {
  const parsed = parseCode(tsx, css, { breakpoints: options?.breakpoints });
  let changed = false;
  const nextElements: Record<string, ScampElement> = {};
  for (const [id, el] of Object.entries(parsed.elements)) {
    if (el.type === 'component-instance' && el.componentName === oldName) {
      changed = true;
      nextElements[id] = { ...el, componentName: newName };
    } else {
      nextElements[id] = el;
    }
  }
  if (!changed) {
    // Short-circuit: no instances reference the old name. Return
    // the original strings so the caller can skip the disk write
    // entirely.
    return { tsx, css, changed: false };
  }
  const importName = format === 'nextjs' ? 'page' : pageName;
  const out = generateCode({
    elements: nextElements,
    rootId: parsed.rootId,
    pageName,
    breakpoints: options?.breakpoints,
    customMediaBlocks: parsed.customMediaBlocks,
    pageKeyframesBlocks: parsed.keyframesBlocks,
    cssModuleImportName: importName,
  });
  return { tsx: out.tsx, css: out.css, changed: true };
};
