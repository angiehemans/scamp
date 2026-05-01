/**
 * Map a Scamp page name to the URL path Next.js serves it from.
 *
 * The home page lives at `app/page.tsx` (route `/`); every other
 * page lives at `app/<name>/page.tsx` (route `/<name>`). This
 * mirrors the `readProjectNextjs` convention in
 * `src/main/ipc/projectScaffold.ts`, which keys the home page
 * internally as `'home'`.
 */
export const pageNameToRoute = (pageName) => {
    if (pageName === 'home' || pageName.length === 0)
        return '/';
    return `/${pageName}`;
};
/**
 * Compose a full preview URL from the dev-server port and a route.
 */
export const previewUrl = (port, route) => {
    const path = route.startsWith('/') ? route : `/${route}`;
    return `http://localhost:${port}${path}`;
};
