import type { MouseEvent as ReactMouseEvent } from 'react';
type Props = {
    componentName: string;
    projectPath: string;
    isActive: boolean;
    onClick: () => void;
    onContextMenu: (e: ReactMouseEvent) => void;
    onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
};
/**
 * Phase 9 — one row of the components sidebar. Holds its own
 * thumbnail state so re-renders of the parent don't bounce the
 * image's loading lifecycle. On mount and on every
 * `scamp:component-thumbnail-updated` event for THIS component,
 * we re-fetch the on-disk PNG (the watcher ignores `.scamp/` so
 * the custom event is the canonical refresh signal). Components
 * that have never been edited / opened in the editor render a
 * placeholder dashed-box icon so the row layout stays consistent.
 */
export declare const ComponentSidebarItem: ({ componentName, projectPath, isActive, onClick, onContextMenu, onDragStart, }: Props) => JSX.Element;
export {};
