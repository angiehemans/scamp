import type { ProjectConfig } from '@shared/types';
type Props = {
    projectName: string;
    projectPath: string;
    config: ProjectConfig;
    onChange: (next: ProjectConfig) => void;
    onBack: () => void;
    /**
     * Scamp-framework projects: the keys in `.dev.vars`, the local secrets
     * `load()` and API routes read through `env`. Values stay on disk.
     */
    environment?: {
        exists: boolean;
        keys: ReadonlyArray<string>;
        onOpen: () => void;
    };
};
export declare const ProjectSettingsPage: ({ projectName, projectPath, environment, config, onChange, onBack, }: Props) => JSX.Element;
export {};
