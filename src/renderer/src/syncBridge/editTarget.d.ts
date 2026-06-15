import { type ProjectFormat } from "@shared/types";
import { type ActiveComponent, type ActivePage } from "@store/canvasSlice";
export declare const WRITE_DEBOUNCE_MS = 200;
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
export declare const toEditTarget: (page: ActivePage | null, component: ActiveComponent | null) => EditTarget | null;
/**
 * CSS-module import name for the active target. Pages route
 * through `cssModuleImportNameFor` (which depends on project
 * format); components always import their own
 * `./<ComponentName>.module.css` regardless of project format.
 */
export declare const importNameForTarget: (target: EditTarget, format: ProjectFormat) => string;
