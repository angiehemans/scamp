import type { ComponentFile, ProjectConfig, RouteFile, RouteRender } from '@shared/types';
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
    /**
     * Scamp-framework projects: every route in the project, page and
     * API. The sidebar's Routes section is scoped to the open page, so
     * this is where the project as a whole is visible.
     */
    routes?: {
        routes: ReadonlyArray<RouteFile>;
        /** Views with no page route yet. */
        unrouted: ReadonlyArray<ComponentFile>;
        busy: boolean;
        onOpen: (file: string) => void;
        onSetRender: (file: string, render: RouteRender) => void;
        onGenerate: (viewName: string) => void;
    };
};
export declare const ProjectSettingsPage: ({ projectName, projectPath, environment, routes, config, onChange, onBack, }: Props) => JSX.Element;
export {};
