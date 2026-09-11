import type { MouseEvent as ReactMouseEvent } from 'react';
type Props = {
    componentName: string;
    projectPath: string;
    isActive: boolean;
    onClick: () => void;
    onContextMenu: (e: ReactMouseEvent) => void;
    /** Default true; views aren't draggable. */
    draggable?: boolean;
    onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
};
/** Sidebar row with thumbnail. see docs/notes/components-thumbnails.md */
export declare const ComponentSidebarItem: ({ componentName, projectPath, isActive, onClick, onContextMenu, draggable, onDragStart, }: Props) => JSX.Element;
export {};
