// syncBridge/editTarget.ts — split out of syncBridge.ts (5.4 safe partial).
import { type ProjectFormat } from "@shared/types";
import { type ActiveComponent, type ActivePage } from "@store/canvasSlice";

export const WRITE_DEBOUNCE_MS = 200;


/**
 * The CSS-module file basename `generateCode` should put in the TSX
 * import line for the given project format. Nextjs projects always
 * import `./page.module.css` (each page lives in its own folder); the
 * legacy flat layout imports `./<pageName>.module.css`.
 */
const cssModuleImportNameFor = (
  format: ProjectFormat,
  pageName: string
): string => (format === 'nextjs' ? 'page' : pageName);


/**
 * Unified shape for "the thing the canvas is currently editing".
 * Wraps either an active page or an active component so the
 * save / load / route-by-path code paths don't have to special-case
 * by kind every place. Each Phase 1+ feature that pivots on the
 * kind reads `target.kind` for branching.
 */
export type EditTarget = {
  kind: 'page' | 'component';
  name: string;
  tsxPath: string;
  cssPath: string;
};


export const toEditTarget = (
  page: ActivePage | null,
  component: ActiveComponent | null
): EditTarget | null => {
  // activeComponent takes precedence — `loadComponent` clears
  // `activePage` and vice versa, so this defensive ordering only
  // matters during the in-flight setState batch where both may
  // briefly be readable.
  if (component) {
    return {
      kind: 'component',
      name: component.name,
      tsxPath: component.tsxPath,
      cssPath: component.cssPath,
    };
  }
  if (page) {
    return {
      kind: 'page',
      name: page.name,
      tsxPath: page.tsxPath,
      cssPath: page.cssPath,
    };
  }
  return null;
};


/**
 * CSS-module import name for the active target. Pages route
 * through `cssModuleImportNameFor` (which depends on project
 * format); components always import their own
 * `./<ComponentName>.module.css` regardless of project format.
 */
export const importNameForTarget = (
  target: EditTarget,
  format: ProjectFormat
): string => {
  if (target.kind === 'component') return target.name;
  return cssModuleImportNameFor(format, target.name);
};

