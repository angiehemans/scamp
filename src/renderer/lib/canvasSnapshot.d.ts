import type { ProjectFormat, ThemeDef, ThemeToken } from '@shared/types';
import { type ContextTarget } from './contextModel';
import type { ScampElement } from './element';
/**
 * The canvas, in the shapes the MCP tools return.
 *
 * The third renderer over `contextModel` — after the context file and the
 * copy-context one-liner — and the reason that model exists. An agent asking
 * "what is selected" and the context file describing the same element must
 * not be able to disagree, so both answer from one derivation.
 *
 * Pure: no store reads, no IPC, no clock. Everything arrives in
 * `SnapshotInput` so the whole surface is testable without an app.
 * see docs/plans/mcp-server-plan.md
 */
/** Everything the eight tools need, supplied by the caller. */
export type SnapshotInput = {
    projectFormat: ProjectFormat;
    /** Null when no project is open. */
    target: ContextTarget | null;
    elements: Record<string, ScampElement>;
    rootElementId: string;
    /** Selection in panel order — index 0 is the primary. */
    selectedIds: ReadonlyArray<string>;
    pageNames: ReadonlyArray<string>;
    componentNames: ReadonlyArray<string>;
    themeTokens: ReadonlyArray<ThemeToken>;
    themes: ReadonlyArray<ThemeDef>;
    activeThemeId: string;
    breakpointId: string;
    breakpointLabel: string;
    canvasWidth: number;
};
export type ActiveTargetResult = {
    kind: 'page' | 'component';
    name: string;
    tsx: string;
    css: string;
} | null;
export type ElementResult = {
    id: string;
    class: string;
    tag: string;
    /** The user's own label, when they've set one. */
    name?: string;
    /** Null for the page/component root. */
    parentId: string | null;
    childIds: string[];
    styles: Record<string, string>;
    customProperties: Record<string, string>;
} | null;
export type TreeNode = {
    id: string;
    class: string;
    tag: string;
    children: TreeNode[];
};
export type FileListItem = {
    name: string;
    tsx: string;
    css: string;
};
export type ThemeTokensResult = {
    tokens: Array<{
        name: string;
        value: string;
    }>;
    themes: Array<{
        id: string;
        label: string;
    }>;
    activeThemeId: string;
};
export type CanvasStateResult = {
    active: ActiveTargetResult;
    selectedElementId: string | null;
    breakpoint: {
        id: string;
        label: string;
        width: number;
    };
    elements: Record<string, NonNullable<ElementResult>>;
    /** Present only when the element cap kicked in. */
    truncated?: {
        returned: number;
        total: number;
        hint: string;
    };
};
/**
 * Ceiling on elements returned by `get_canvas_state`.
 *
 * The whole map on a busy page runs to tens of kilobytes, and it lands
 * directly in the agent's context window. Agents reach for the broadest tool
 * first, so an uncapped version would be the expensive default rather than
 * the considered choice. A truncated answer that SAYS it was truncated beats
 * both an unbounded one and no tool at all.
 */
export declare const CANVAS_STATE_ELEMENT_LIMIT = 200;
/**
 * Project-relative POSIX paths for a page.
 *
 * Mirrors `main/ipc/pageOps.ts` → `pagePathsFor`, which is the source of
 * truth for where pages live. Duplicated rather than imported because that
 * one builds ABSOLUTE paths with `path.join` — backslashes on Windows, and a
 * leaked home directory in text an agent will quote back.
 */
export declare const pagePathsRelative: (pageName: string, format: ProjectFormat) => {
    tsx: string;
    css: string;
};
/** Mirrors `main/ipc/componentOps.ts` → `componentPathsFor`. */
export declare const componentPathsRelative: (name: string) => {
    tsx: string;
    css: string;
};
export declare const getActiveTarget: (input: SnapshotInput) => ActiveTargetResult;
export declare const getSelectedElement: (input: SnapshotInput) => ElementResult;
export declare const getElementById: (input: SnapshotInput, id: string) => ElementResult;
/**
 * The tree, ids and tags only.
 *
 * Deliberately style-free — this is the cheap structural tool an agent uses
 * to orient before pulling detail with `get_element_by_id`. Adding styles
 * here would make it another `get_canvas_state`.
 */
export declare const getElementTree: (input: SnapshotInput) => {
    root: TreeNode;
} | null;
export declare const listPages: (input: SnapshotInput) => FileListItem[];
/**
 * Components by name and path.
 *
 * No `variants` field: variants aren't on `main` yet, and a field an agent is
 * told to expect but always finds empty reads as "this component has none".
 * Adding it later is additive.
 */
export declare const listComponents: (input: SnapshotInput) => FileListItem[];
/**
 * Theme tokens exactly as they sit in `theme.css` — a flat list, not grouped
 * into colours / typography / spacing.
 *
 * The agent reading this is usually about to EDIT that file. Inventing a
 * structure the file doesn't have would leave it editing against the wrong
 * shape, and the grouping would have to be guessed from name prefixes, which
 * breaks silently the first time a token is named unconventionally.
 */
export declare const getThemeTokens: (input: SnapshotInput) => ThemeTokensResult;
/**
 * Map an MCP tool name onto its snapshot function.
 *
 * Lives here rather than in the renderer's IPC responder so the whole tool
 * surface is testable without a window — the responder becomes "read store,
 * call this, reply".
 *
 * Throws on an unknown name: the protocol layer has already checked it, so
 * reaching here means the two lists have drifted, and a thrown error surfaces
 * that as an `isError` result rather than a confusing `null`.
 */
export declare const answerSnapshotTool: (tool: string, args: Record<string, unknown>, input: SnapshotInput) => unknown;
export declare const getCanvasState: (input: SnapshotInput) => CanvasStateResult;
