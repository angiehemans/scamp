import type { DevVarsReadResult, RouteFile, RouteRender } from '@shared/types';
/** The URL pattern a route file answers, or null for a file that is not a route. */
export declare const routePathFor: (file: string) => string | null;
export declare const isApiRouteFile: (file: string) => boolean;
/** The `render` export, or null when the file declares none. */
export declare const parseRenderExport: (tsx: string) => RouteRender | null;
/** The view a route imports from `views/<Name>/<Name>`, or null. */
export declare const parseViewImport: (tsx: string) => string | null;
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
