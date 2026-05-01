import type { PageFile, ProjectFormat } from '@shared/types';
/**
 * Path on disk where a project's `theme.css` lives. Nextjs projects
 * co-locate it inside `app/` so the root layout can import it and
 * `next dev` picks up the tokens; legacy keeps it at the project root.
 */
export declare const themePathFor: (projectPath: string, format: ProjectFormat) => string;
export declare const readProjectLegacy: (folderPath: string) => Promise<PageFile[]>;
/**
 * Read pages from a Next.js App Router project layout. The root page
 * lives at `app/page.tsx` and is keyed as `'home'` internally so the
 * rest of the app (sidebar labelling, component-name derivation, page
 * switching) works without special-casing. Additional pages live in
 * folders inside `app/` — e.g. `app/about/page.tsx` is keyed `'about'`.
 */
export declare const readProjectNextjs: (folderPath: string) => Promise<PageFile[]>;
/**
 * Write the Next.js App Router scaffold into a freshly-created
 * project folder. Creates `app/` (with the home page, layout, and
 * `theme.css` co-located so `next dev` picks up the tokens),
 * `public/assets/`, and the auto-generated `package.json` /
 * `next.config.ts` at the project root.
 *
 * Caller is responsible for creating the project directory itself
 * and for writing `scamp.config.json` (via `ensureProjectConfig`).
 */
export declare const scaffoldNextjsProject: (projectPath: string, projectName: string) => Promise<void>;
/**
 * Refresh `app/layout.tsx` if it byte-matches a known legacy template.
 * Called on project open so old projects pick up the body reset
 * (`margin: 0; min-height: 100vh`) without a manual edit. User-
 * customised layouts are left alone — `decideLayoutMigration` returns
 * `'warn'` and we surface a one-line hint via the main-process console
 * so users hitting "preview is blank" can find the cause.
 *
 * Idempotent: subsequent calls with the latest template are a no-op
 * (no log spam on repeat opens).
 */
export declare const refreshLayoutTemplateIfNeeded: (projectPath: string) => Promise<void>;
/**
 * Legacy flat-layout scaffold. Kept around for the migrator's
 * fixture-creation tests and for parity in the shared scaffold module.
 */
export declare const scaffoldLegacyProject: (projectPath: string) => Promise<void>;
