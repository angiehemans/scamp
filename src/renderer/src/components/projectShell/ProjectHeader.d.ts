import type { ProjectFormat } from '@shared/types';
import type { BottomPanel } from '@store/canvasSlice';
type Props = {
    projectName: string;
    bottomPanel: BottomPanel;
    canPreview: boolean;
    projectFormat: ProjectFormat;
    onClose: () => void;
    onToggleCode: () => void;
    onToggleTerminal: () => void;
    onOpenPreview: () => void;
};
/** Top toolbar: back-to-projects, zoom, code/terminal/preview toggles. */
export declare const ProjectHeader: ({ projectName, bottomPanel, canPreview, projectFormat, onClose, onToggleCode, onToggleTerminal, onOpenPreview, }: Props) => JSX.Element;
export {};
