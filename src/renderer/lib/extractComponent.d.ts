import { type ScampElement } from './element';
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
export declare const extractSubtreeAsComponent: (elements: Record<string, ScampElement>, subtreeRootId: string) => {
    elements: Record<string, ScampElement>;
    rootId: string;
} | null;
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
export declare const generateComponentFromSubtree: (elements: Record<string, ScampElement>, subtreeRootId: string, componentName: string, breakpoints?: ReadonlyArray<Breakpoint>) => {
    tsx: string;
    css: string;
} | null;
