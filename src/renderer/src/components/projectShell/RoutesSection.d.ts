import type { ComponentFile, RouteFile, RouteRender } from '@shared/types';
type Props = {
    routes: ReadonlyArray<RouteFile>;
    /** Views in the project; those no page route renders get a Generate action. */
    views: ReadonlyArray<ComponentFile>;
    /** The view open on the canvas. The section shows its routes alone. */
    activeViewName: string | null;
    busy: boolean;
    onOpen: (file: string) => void;
    onSetRender: (file: string, render: RouteRender) => void;
    onGenerate: (viewName: string) => void;
};
/**
 * The Routes section of a Scamp-framework project: the routes that
 * render the open page, their render mode, and Generate route when the
 * page has none yet. The framework owns the routes; the app lists them
 * and writes only the `render` export and a generated file.
 *
 * It shows the open page's routes rather than the project's. The
 * section sits in the properties panel's empty state, which is about
 * the page in front of you — a list of every route in the project
 * belongs to a project view, not to this one.
 * see docs/notes/routes-in-the-app.md
 */
export declare const RoutesSection: ({ routes, views, activeViewName, busy, onOpen, onSetRender, onGenerate, }: Props) => JSX.Element;
export {};
