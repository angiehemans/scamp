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
type RouteListProps = {
    /** Already scoped by the caller: the sidebar filters, settings does not. */
    routes: ReadonlyArray<RouteFile>;
    /** Views with no page route, offered a Generate action. */
    unrouted: ReadonlyArray<ComponentFile>;
    busy: boolean;
    onOpen: (file: string) => void;
    onSetRender: (file: string, render: RouteRender) => void;
    onGenerate: (viewName: string) => void;
};
/**
 * The rows: a route's path with its render mode under it, and a
 * Generate action per view nothing renders. Shared by the sidebar
 * section and the project settings page so the two can't drift.
 */
export declare const RouteList: ({ routes, unrouted, busy, onOpen, onSetRender, onGenerate, }: RouteListProps) => JSX.Element;
export declare const RoutesSection: ({ routes, views, activeViewName, busy, onOpen, onSetRender, onGenerate, }: Props) => JSX.Element;
/** Every route in the project, for the settings page. */
export declare const allUnroutedViews: (routes: ReadonlyArray<RouteFile>, views: ReadonlyArray<ComponentFile>) => ComponentFile[];
export {};
