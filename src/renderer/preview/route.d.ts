/**
 * Map a Scamp page name to the URL path Next.js serves it from.
 *
 * The home page lives at `app/page.tsx` (route `/`); every other
 * page lives at `app/<name>/page.tsx` (route `/<name>`). This
 * mirrors the `readProjectNextjs` convention in
 * `src/main/ipc/projectScaffold.ts`, which keys the home page
 * internally as `'home'`.
 */
export declare const pageNameToRoute: (pageName: string) => string;
/**
 * Compose a full preview URL from the dev-server port and a route.
 */
export declare const previewUrl: (port: number, route: string) => string;
