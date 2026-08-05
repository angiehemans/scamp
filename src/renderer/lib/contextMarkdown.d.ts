import type { ScampElement } from './element';
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
/**
 * Render the whole file.
 *
 * Sections that would be empty are omitted rather than emitted with a
 * placeholder — an agent reading "Custom properties: none" learns nothing,
 * while an absent heading is unambiguous.
 */
export declare const buildContextMarkdown: (input: ContextInput) => string;
