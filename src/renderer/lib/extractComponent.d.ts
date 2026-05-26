import { type ScampElement } from './element';
import type { Breakpoint } from '@shared/types';
/**
 * Lift a subtree into a standalone elements map. Subtree root is
 * renamed to `ROOT_ELEMENT_ID`. see docs/notes/components-data-model.md
 */
export declare const extractSubtreeAsComponent: (elements: Record<string, ScampElement>, subtreeRootId: string) => {
    elements: Record<string, ScampElement>;
    rootId: string;
} | null;
/** Generate component TSX + CSS from a subtree of a page's elements. */
export declare const generateComponentFromSubtree: (elements: Record<string, ScampElement>, subtreeRootId: string, componentName: string, breakpoints?: ReadonlyArray<Breakpoint>) => {
    tsx: string;
    css: string;
} | null;
