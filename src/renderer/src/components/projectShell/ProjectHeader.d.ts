import type { ProjectFormat } from '@shared/types';
type Props = {
    projectName: string;
    canPreview: boolean;
    projectFormat: ProjectFormat;
    onClose: () => void;
    onOpenPreview: () => void;
};
/**
 * Top toolbar: back-to-projects, zoom, preview, save status, project name.
 *
 * The code and terminal toggles moved to the canvas toolbar (right-aligned,
 * icon-only) — they act on the canvas, so they belong with it.
 */
export declare const ProjectHeader: ({ projectName, canPreview, projectFormat, onClose, onOpenPreview, }: Props) => JSX.Element;
export {};
