import { type RefObject } from 'react';
import type { ProjectConfig } from '@shared/types';
import type { ActiveComponent } from './types';
type Props = {
    activeComponent: ActiveComponent | null;
    activePageName: string | null;
    projectConfig: ProjectConfig;
    artboardScrollRef: RefObject<HTMLDivElement>;
    onProjectConfigChange: (next: ProjectConfig) => void;
    onExitComponentEditor: () => void;
    onOpenSettings: () => void;
    onOpenTheme: () => void;
};
/**
 * The artboard column: component-editor banner + breadcrumb, the canvas
 * size control, the scrollable Viewport, and the element toolbar. Page
 * mode uses the project-wide canvas width; component mode uses the
 * per-component canvas size and enables drag-handle resize.
 */
export declare const CanvasArea: ({ activeComponent, activePageName, projectConfig, artboardScrollRef, onProjectConfigChange, onExitComponentEditor, onOpenSettings, onOpenTheme, }: Props) => JSX.Element;
export {};
