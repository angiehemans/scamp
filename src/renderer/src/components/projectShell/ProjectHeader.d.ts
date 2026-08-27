import type { ProjectFormat } from '@shared/types';
import { type HtmlExportStatus } from '@lib/htmlExportStatus';
type Props = {
    projectName: string;
    canPreview: boolean;
    projectFormat: ProjectFormat;
    onClose: () => void;
    onOpenPreview: () => void;
    onExportHtml: () => void;
    exportStatus: HtmlExportStatus;
    exportMessage: string | null;
    exportLocation: string | null;
};
/**
 * Top toolbar: back-to-projects, zoom, preview, save status, project name.
 *
 * The code and terminal toggles moved to the canvas toolbar (right-aligned,
 * icon-only) — they act on the canvas, so they belong with it.
 */
export declare const ProjectHeader: ({ projectName, canPreview, projectFormat, onClose, onOpenPreview, onExportHtml, exportStatus, exportMessage, exportLocation, }: Props) => JSX.Element;
export {};
