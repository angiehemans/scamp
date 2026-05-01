import type { ProjectData } from '@shared/types';
type Props = {
    project: ProjectData;
    onClose: () => void;
    /** Called after a page is added, duplicated, or deleted. */
    onProjectChange?: (next: ProjectData) => void;
};
export declare const ProjectShell: ({ project, onClose, onProjectChange, }: Props) => JSX.Element;
export {};
