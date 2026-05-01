import type { ProjectData } from '@shared/types';
type Props = {
    onProjectOpened: (project: ProjectData) => void;
    onOpenSettings: () => void;
};
export declare const StartScreen: ({ onProjectOpened, onOpenSettings }: Props) => JSX.Element;
export declare const projectNameFromPath: (p: string) => string;
export {};
