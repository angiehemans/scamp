import type { ComponentFile, RouteFile, RouteRender } from '@shared/types';
type Props = {
    routes: ReadonlyArray<RouteFile>;
    /** Views in the project; those no page route renders get a Generate action. */
    views: ReadonlyArray<ComponentFile>;
    busy: boolean;
    onOpen: (file: string) => void;
    onSetRender: (file: string, render: RouteRender) => void;
    onGenerate: (viewName: string) => void;
};
/**
 * The Routes section of the sidebar in a Scamp-framework project: every
 * file under routes/, its render mode, and Generate route for a view no
 * route renders yet. The framework owns the routes; the app lists them
 * and writes only the `render` export and a generated file.
 * see docs/notes/routes-in-the-app.md
 */
export declare const RoutesSection: ({ routes, views, busy, onOpen, onSetRender, onGenerate }: Props) => JSX.Element;
export {};
