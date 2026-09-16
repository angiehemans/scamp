# Sunsetting the Next.js path

Since phase 5, **New project** writes the Scamp framework structure
(`views/`, `routes/`, `design/`, `scampjs`) and never `app/`. Existing
Next.js projects keep working unchanged, get a migration banner, and
lose nothing until the criteria below are met. This note is the list of
what "the Next.js path" is, so it can be removed together, and the
criteria for removing it.

## Frozen, not removed

The Next.js path gets no new features. Bugs are fixed. Anything new
lands on the framework path only. In code, "Next.js path" means every
branch on `format === 'nextjs'` and every file below.

| File | What it does for Next.js |
| --- | --- |
| `src/shared/templates/nextConfig.ts` | `next.config.ts` template |
| `src/shared/templates/pageScaffold.ts` | `app/layout.tsx`, the Next `package.json`, the plain page template |
| `src/shared/templates/viewWrapper.ts` | the one-line `app/<slug>/page.tsx` wrapper a view previews through |
| `src/shared/tsconfigAlias.ts` | the Next `tsconfig.json` and its `@/*` alias check |
| `src/main/ipc/projectScaffold.ts` | `scaffoldNextjsProject`, `readProjectNextjs`, `refreshLayoutTemplateIfNeeded`, `ensureTsConfigIfNeeded`, the Next `.gitignore` |
| `src/main/ipc/pageOps.ts`, `pageRename.ts` | `app/<slug>/page.tsx` paths, wrapper pages on view create and rename |
| `src/main/ipc/projectMigrate.ts` | `migrateLegacyToNextjs` (legacy still migrates through Next, one step at a time) |
| `src/main/ipc/snapshotOps.ts`, `themeOps.ts`, `designMdOps.ts` | `app/`-shaped enumeration, `app/theme.css`, root `DESIGN.md` |
| `src/main/devServer/devServerManager.ts`, `readyDetector.ts` | `npm run dev` for `next dev` and its `Local:` / `Ready in` detection |
| `src/renderer/preview/route.ts` | the `/` and `/<name>` route mapping |
| `src/renderer/src/components/ProjectShell.tsx` | the wrapper-route preview target, the `ScampMigrationNotice` gate |
| `src/renderer/src/components/NextjsMigrationBanner.tsx` | legacy → Next.js |
| `src/shared/templates/agentMd.ts` | `NEXT_LAYOUT_PARAGRAPH`, `NEXT_WRAPPER_NOTE` |
| `test/e2e/fixtures/project.ts` | the `nextjs` scaffold branch |

Shared between formats and staying: `components/`, `public/assets/`,
`.scamp/`, `scamp.config.json`, the MCP server, snapshots, the parser
and generator.

## The migration

`ScampMigrationNotice` on a Next.js project, a section of the
properties panel rather than a bar across the top of the app: a
snapshot, every plain
page converted to a view in the renderer (`convertAllPagesToViews`,
the same code as the page menu's Convert), then `migrateNextjsToScamp`
in the main process turns each wrapper into a route, moves the theme
and `DESIGN.md` under `design/`, rewrites `package.json`, replaces an
untouched `tsconfig.json`, and moves the Next.js files (`app/` pages,
`layout.tsx`, `next.config.ts`, `node_modules`, `.next`) into
`.scamp-backup-<timestamp>/` at their original paths. Anything under
`app/` it didn't write (API routes, hand-written pages), a `features/`
folder, and a customised `tsconfig.json` are left in place and listed
in the result's `unmovedFiles`, which the banner logs.

A page's markup is byte-identical inside its view; only the import
line, the props signature, the root `className` passthrough, and the
`_scamp` export are added, and the page root's `min-height: 100vh`
floor is dropped. The migration e2e spec asserts the markup.

## Removal criteria

Remove the files above together, in one release, when both hold:

- The migration has been offered for several releases (banner shipped
  in the release after phase 5).
- Opted-in telemetry shows Next.js projects at a negligible share of
  opens, or no Next.js project has been opened for a release cycle.

Until then, opening a Next.js project is a first-class, tested path:
the core e2e specs run against it (`SCAMP_E2E_FORMAT=nextjs`), and the
migration has its own spec.
