/**
 * Default page TSX content for a freshly created page. The
 * `cssModuleImportName` defaults to `moduleName`, which gives the
 * legacy flat-layout import (`./<page>.module.css`); pass `'page'` for
 * the Next.js App Router layout where every page imports its co-
 * located `./page.module.css` regardless of slug.
 */
export declare const defaultPageTsx: (componentName: string, moduleName: string, cssModuleImportName?: string) => string;
/**
 * Auto-generated `app/layout.tsx` for a Next.js-format project. Imports
 * the project's `theme.css` so the design tokens it defines apply when
 * the user runs `next dev` outside Scamp. The user is documented (in
 * `agent.md`) to leave this file alone.
 *
 * The `<body>` carries `margin: 0` and `minHeight: '100vh'` — body
 * chrome that needs to live somewhere visible to Next.js but isn't a
 * design choice. The default font-family lives in `theme.css` (a
 * `body { font-family: var(--font-sans); }` rule) so it shows up
 * alongside the other design tokens the user can edit.
 */
export declare const defaultLayoutTsx: (projectName: string) => string;
/**
 * Earlier `defaultLayoutTsx` outputs that `migrateLayoutTemplate`
 * should treat as "user hasn't customised this — safe to replace
 * with the latest template." Only literal byte-for-byte matches
 * count: any user edit (rename, reformatting, additional imports)
 * fails the comparison and the legacy template is left alone.
 *
 * Append (don't replace) when changing `defaultLayoutTsx`: every
 * past version of the auto-generated layout needs to remain
 * matchable so users on old Scamp installs can migrate forward
 * later.
 */
export declare const LEGACY_LAYOUT_TEMPLATES: (projectName: string) => readonly string[];
/**
 * Auto-generated `package.json` for a Next.js-format project. Pinned
 * minor versions for the Next.js / React stack so a Scamp-created
 * project doesn't quietly drift onto a major-version bump that breaks
 * the App Router conventions Scamp relies on.
 */
export declare const defaultPackageJson: (projectName: string) => string;
