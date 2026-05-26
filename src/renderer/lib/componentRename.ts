import { generateCode } from './generateCode';
import { parseCode } from './parseCode';
import type { ScampElement } from './element';
import type { Breakpoint } from '@shared/types';

// Pure rewrite helpers for component rename.
// see docs/notes/components-multi-file-ops.md

type RewriteOptions = {
  breakpoints?: ReadonlyArray<Breakpoint>;
};

/** Flip a component file's function name, Props type, and import basename. */
export const rewriteComponentForRename = (
  tsx: string,
  css: string,
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

/** Rewrite a page TSX/CSS to use newName for matching instances. `changed: false` → skip the disk write. */
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
