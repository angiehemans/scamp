import type { DevVarsReadResult, RouteFile, RouteRender } from '@shared/types';
/** The URL pattern a route file answers, or null for a file that is not a route. */
export declare const routePathFor: (file: string) => string | null;
export declare const isApiRouteFile: (file: string) => boolean;
/** The `render` export, or null when the file declares none. */
export declare const parseRenderExport: (tsx: string) => RouteRender | null;
/** The view a route imports from `views/<Name>/<Name>`, or null. */
export declare const parseViewImport: (tsx: string) => string | null;
/**
 * Point a route at a renamed view: its import, the tag it renders, and
 * the route function's own name when it was named after the view.
 *
 * A rewrite rather than a regeneration. By the time a view is renamed
 * the route may hold a real `load()`, a query, or anything else its
 * author put there, and none of that is the app's to rewrite.
 */
export declare const renameRouteView: (tsx: string, oldName: string, newName: string) => string;
/** `home` is the root route; every other slug is its own file. */
export declare const routeFileForSlug: (slug: string) => string;
/**
 * Follow a view rename into the route that renders it: rewrite the
 * references, and move the file when its name was the one the app
 * would have given it. A route the developer put somewhere else —
 * nested, or named for the URL rather than the view — keeps its place;
 * only its references change, because the URL is their decision and
 * the broken import is not.
 *
 * Returns the route's file after the rename, or null when no route
 * renders that view.
 */
export declare const renameRouteForView: (projectPath: string, oldView: string, newView: string) => Promise<string | null>;
/**
 * Write a `render` export: replace the existing one, or add it after the
 * imports. `static` is the framework's default, but writing it keeps the
 * user's choice visible in the file.
 */
export declare const setRenderExport: (tsx: string, mode: RouteRender) => string;
/** Every route file, page routes first, each in path order. */
export declare const listRoutes: (projectPath: string) => Promise<RouteFile[]>;
export declare const readRouteFile: (projectPath: string, file: string) => Promise<string>;
export declare const setRouteRender: (projectPath: string, file: string, render: RouteRender) => Promise<void>;
/** Write a new route file; an existing one is the user's and is never replaced. */
export declare const writeRouteFile: (projectPath: string, file: string, content: string) => Promise<void>;
/** The keys in `.dev.vars`. Values stay on disk: the renderer never sees a secret. */
export declare const readDevVarsKeys: (projectPath: string) => Promise<DevVarsReadResult>;
