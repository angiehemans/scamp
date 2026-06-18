import type { PageFile } from '@shared/types';
import type { ActiveComponent, DeletePropTextRequest } from './types';
/**
 * The subset of ProjectShell closure values the global keydown listener
 * reads. Passed via a `useLatest` ref so the listener binds once for the
 * component's lifetime and still sees current values — everything else it
 * touches goes through the store's `getState()`.
 */
export type KeyboardShortcutDeps = {
    toggleTerminalPanel: () => void;
    canPreview: boolean;
    openPreview: () => void;
    projectPages: PageFile[];
    setDeletePropTextRequest: (req: DeletePropTextRequest) => void;
};
/**
 * Owns ProjectShell's two keyboard concerns:
 *   - the global canvas shortcuts (zoom, copy/paste, undo/redo, group,
 *     duplicate, delete, arrow-nudge, terminal/preview toggles), bound
 *     once and reading fresh values via `keyDeps`;
 *   - the component-editor Esc handler, which exits back to the prior
 *     page and re-binds whenever the active component changes.
 */
export declare const useCanvasKeyboardShortcuts: (keyDeps: {
    current: KeyboardShortcutDeps;
}, componentEditor: {
    activeComponent: ActiveComponent | null;
    latestExit: {
        current: () => void;
    };
}) => void;
