import type { ProjectConfig } from '@shared/types';
type Props = {
    projectName: string;
    projectPath: string;
    config: ProjectConfig;
    onChange: (next: ProjectConfig) => void;
    onBack: () => void;
};
export declare const ProjectSettingsPage: ({ projectName, projectPath, config, onChange, onBack, }: Props) => JSX.Element;
export {};
