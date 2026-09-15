import type { ProjectData, RouteFile, RouteRender } from '@shared/types';
export type UseRoutes = {
    routes: ReadonlyArray<RouteFile>;
    busy: boolean;
    openRoute: (file: string) => Promise<void>;
    setRender: (file: string, render: RouteRender) => Promise<void>;
    generateRoute: (viewName: string) => Promise<void>;
};
/**
 * The routes of a Scamp-framework project as the sidebar shows them:
 * read from the project on open, re-read when a file under routes/
 * changes on disk, and after the two writes the app makes (the render
 * export, a generated route). see docs/notes/routes-in-the-app.md
 */
export declare const useRoutes: (project: ProjectData) => UseRoutes;
