import type { ViewProp } from './viewProps';
/**
 * Generate route: the `routes/<slug>.tsx` that renders a view with its
 * own sample data. The view's props type is the contract a `load()`
 * must satisfy, so the generated `load()` returns the samples, typed by
 * inference, and the developer or agent replaces them with real data.
 * Pure. see docs/notes/routes-in-the-app.md
 */
export type GenerateRouteInput = {
    viewName: string;
    /** The route slug: `home` maps to `/`, anything else to `/<slug>`. */
    slug: string;
    props: ReadonlyArray<ViewProp>;
    /** A Drizzle recipe is present (`lib/db.ts`): add the commented query. */
    hasDatabase: boolean;
};
/** The route file for a slug, relative to `routes/`. */
export declare const routeFileForSlug: (slug: string) => string;
export declare const generateRouteTsx: (input: GenerateRouteInput) => string;
