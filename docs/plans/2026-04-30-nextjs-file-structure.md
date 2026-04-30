# Next.js App Router File Structure — Plan

**Status:** Draft for review.
**Date:** 2026-04-30
**Source:** `docs/new-file-structure.md`

## Goal

Switch new Scamp projects to a real Next.js App Router layout so they
can be opened directly in a Next.js workspace with no reorganisation.
Old flat-format projects keep working as-is — no forced migration.
Existing users get an opt-in one-click migrator.

Preview mode (`next dev`, embedded dev-server, HMR) is explicitly
**out of scope** for this project — we'll do that in a follow-up. The
work here is everything needed for the **on-disk layout** to change,
including create/open/sync/page-ops/migration.

---

## Current state

A Scamp project today is flat:

```
my-project/
├── agent.md
├── theme.css
├── scamp.config.json
├── home.tsx
├── home.module.css
├── about.tsx
├── about.module.css
└── assets/
    └── hero.png
```

Key code paths that bake in this layout:

- `src/main/ipc/project.ts` — `readProject` scans the project root for
  `*.tsx` files paired with `*.module.css`.
- `src/main/ipc/page.ts` — `page:create`, `page:delete`,
  `page:duplicate` write/remove `<name>.tsx` + `<name>.module.css`
  at the project root.
- `src/main/ipc/pageRename.ts` — same flat assumption.
- `src/main/ipc/image.ts` — `copyImage` writes to `assets/` and
  returns `./assets/<file>`.
- `src/main/watcher.ts` — `chokidar.watch(folderPath, { depth: 1 })`
  watches one level deep; sibling-pair resolution uses
  `dirname(changedPath)` (already filename-agnostic, but the depth
  limit will need raising).
- `src/renderer/lib/generateCode.ts` — emits
  `import styles from './<pageName>.module.css';`.
- `src/renderer/lib/parseCode.ts` — pure on input; doesn't care about
  the path, but the import-line regex expects the legacy filename.
- `src/shared/agentMd.ts` — the `AGENT_MD_CONTENT` template documents
  the flat layout (`Each page is two files: [page-name].tsx and
  [page-name].module.css.`).
- `RecentProject` (in `src/shared/types.ts`) has no `format` field.

The unrelated `MigrationBanner` component already in the tree handles
the canvas-size CSS migration. **Don't reuse it** — that's a different
flow with different copy and we don't want to confuse the two
migrations. New banner for the nextjs migration.

---

## Target state

### New project layout (created fresh)

```
my-project/
├── agent.md
├── theme.css                ← stays at project root (see Q1 below)
├── scamp.config.json
├── package.json             ← auto-generated
├── next.config.ts           ← auto-generated
├── app/
│   ├── layout.tsx           ← auto-generated
│   ├── page.tsx             ← root/home page (label: "Home")
│   ├── page.module.css
│   ├── about/
│   │   ├── page.tsx
│   │   └── page.module.css
│   └── dashboard/
│       ├── page.tsx
│       └── page.module.css
└── public/
    └── assets/
        └── hero.png
```

### Detection on open

In `readProject`, before parsing:

1. If `<projectPath>/app/` exists and contains `page.tsx` → `nextjs`.
2. Else if any `*.tsx` exists at the project root → `legacy`.
3. Else → treat as a new empty project (default to `nextjs`).

The detected format is returned on `ProjectData` and persisted to the
recent-projects entry so we don't re-detect on every reopen.

---

## Data-shape changes

### `ProjectData` (`src/shared/types.ts`)

```ts
export type ProjectFormat = 'legacy' | 'nextjs';

export type ProjectData = {
  path: string;
  name: string;
  format: ProjectFormat;
  pages: PageFile[];
};
```

`PageFile.tsxPath` / `cssPath` already absolute — no shape change there.
The `name` field is the page slug, same as today (`home`, `about`).

### `RecentProject`

```ts
export type RecentProject = {
  name: string;
  path: string;
  format: ProjectFormat;        // NEW
  lastOpened: string;
};
```

`recentProjects.json` reader backfills `format: 'legacy'` for entries
written before this change so older installs don't crash on open.

### IPC

No new IPC channels required for the basic format switch — the
existing `project:*`, `page:*`, and `file:*` handlers all dispatch on
the project's format internally. One new channel for the migrator:

```ts
ProjectMigrate: 'project:migrate',
```

---

## Code organisation — namespacing legacy

Per the user story: *"legacy code paths should be clearly namespaced
in the codebase: `generateCodeLegacy` vs `generateCode`."*

| New (nextjs)             | Legacy (flat)                       |
|--------------------------|-------------------------------------|
| `generateCode`           | `generateCodeLegacy`                |
| `parseCode`              | `parseCodeLegacy`                   |
| `readProject`            | `readProjectLegacy`                 |
| `handleCreate` (page)    | `handleCreateLegacy`                |
| `handleDuplicate`        | `handleDuplicateLegacy`             |
| `renamePageFiles`        | `renamePageFilesLegacy`             |

The renderer's `syncBridge` and the IPC layer pick the right pair based
on `project.format`. Two parallel implementations is more code than a
single parameterised function, but it makes the legacy path obvious and
deletable when we eventually remove it. The current single
implementation becomes the legacy one almost untouched — most of the
new implementation is small deltas (different paths, different import
line, different asset prefix).

Tests get the same split: `generateCode.test.ts` + 
`generateCodeLegacy.test.ts`. The round-trip invariant is asserted
for **both** pairs.

---

## What changes in `generateCode` / `parseCode`

The pure-function pair stays small. Concrete differences vs legacy:

1. **CSS-module import line**
   - Legacy: `import styles from './<pageName>.module.css';`
   - New: `import styles from './page.module.css';`
   The CSS file basename is constant in nextjs (`page.module.css`); only
   the folder distinguishes pages.

2. **Asset paths inside emitted CSS / TSX**
   - Legacy: `url('./assets/hero.png')`, `<img src="./assets/hero.png" />`
   - New: `url('/assets/hero.png')`, `<img src="/assets/hero.png" />`
   Conversion is text-level: a regex over the emitted CSS/TSX string is
   sufficient because asset references are always relative-from-page in
   the legacy format.

3. **Component name** still derives from the page slug (`about` →
   `About`). Same `componentNameFromPage` helper.

`parseCode` mirror: the import-line and asset-reference regex relax for
the new format. Same baseline merge with `DEFAULT_RECT_STYLES`, same
custom-property passthrough, same `customMediaBlocks` handling.

---

## What changes in IPC handlers

### `project:create` (new format)

Writes:

- `agent.md` (new template — see "agent.md template" below)
- `theme.css` (unchanged content, project root — see Q1)
- `scamp.config.json` (unchanged)
- `package.json` (new — minimal `next`, `react`, `react-dom` deps;
  `dev: "next dev"`, `build: "next build"`, `start: "next start"`)
- `next.config.ts` (new — empty config object)
- `app/layout.tsx` (new — root layout with `<html><body>{children}</body></html>`)
- `app/page.tsx` + `app/page.module.css` (root/home page)
- `public/assets/` (empty directory — created so the watcher and image
  copier always have a target)

### `project:open`

`readProject` detects format and returns the right `ProjectData.format`.
For nextjs:

```ts
const readProjectNextjs = async (path) => {
  const appDir = join(path, 'app');
  const pages: PageFile[] = [];
  // root page
  pages.push(await readPageFromDir(appDir, 'home'));
  // nested page folders
  const entries = await fs.readdir(appDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const tsxPath = join(appDir, e.name, 'page.tsx');
    const cssPath = join(appDir, e.name, 'page.module.css');
    if (await both(tsxPath, cssPath)) {
      pages.push({ name: e.name, tsxPath, cssPath, ...contents });
    }
  }
  return { path, name: basename(path), format: 'nextjs', pages };
};
```

Note: the root page's `name` stays `'home'` internally so
the rest of the renderer (active-page selection, sidebar labelling,
generateCode's component-name derivation) keeps working with no
special-casing. The sidebar renders `home` as `"Home"` (it already does
for legacy).

### `page:create` / `page:delete` / `page:duplicate` / `page:rename`

For `nextjs` projects:

- **Create `<name>`** — `mkdir app/<name>`, write `page.tsx` and
  `page.module.css` inside. Reject if the folder already exists.
- **Delete `<name>`** — `rm -rf app/<name>`. Refuse to delete the root
  page (`app/page.tsx`) — same minimum-of-one-page guard the UI
  already enforces.
- **Duplicate `<src>` → `<new>`** — `mkdir app/<new>`, copy the two
  files, rewrite the component name (CSS-module import line in the
  new format always points at `./page.module.css`, so no import
  rewrite needed).
- **Rename `<old>` → `<new>`** — `rename app/<old>` → `app/<new>`,
  rewrite the component name in `page.tsx`. No CSS-module import
  rewrite needed (the import is always `./page.module.css`).

The handlers branch on `args.format` (added to each `Page*Args`) or
look up the format from a small main-side cache populated at
`project:open`. **Recommend a cache** so the renderer doesn't have to
thread `format` through every IPC payload — fewer places to forget.

### `file:write` and `file:patch`

No changes — they take absolute paths and don't care about layout.

### `file:copyImage`

For `nextjs` projects, target dir is `<project>/public/assets/` and
the returned `relativePath` is `/assets/<file>` (absolute server path).
For legacy, behaviour is unchanged. Decided by looking up the project
format from the same main-side cache.

### Watcher (`src/main/watcher.ts`)

- Bump `depth: 1` to cover `app/<page>/*` — `depth: 3` is enough
  (`<projectRoot> → app → <page> → page.tsx`).
- Sibling-pair resolution already uses `dirname(changedPath)`, which
  works in both formats.
- `theme.css` and `scamp.config.json` detection by basename still
  works — they stay at project root.
- The watcher doesn't need to know the format.

---

## Migration flow (legacy → nextjs)

### UI

A new banner component, `NextjsMigrationBanner` (separate from the
existing `MigrationBanner`):

```
┌──────────────────────────────────────────────────────────┐
│ This project uses the legacy file structure.            │
│  [Migrate to Next.js format]   [Dismiss]                │
└──────────────────────────────────────────────────────────┘
```

Shown only on legacy projects, only when not previously dismissed.
Dismissal is per-project — stored in `scamp.config.json` as
`nextjsMigrationDismissed: true`.

### Migrator IPC: `project:migrate`

```ts
type ProjectMigrateArgs = { projectPath: string };
type ProjectMigrateResult = { project: ProjectData };
```

Steps (atomic — stage in a sibling temp dir, swap on success):

1. Create `<project>/.scamp-migrate-<uuid>/` work dir.
2. For each page on disk:
   - Read `<page>.tsx` + `<page>.module.css`.
   - If `<page>` is `home`, target is `app/page.tsx` + `app/page.module.css`.
   - Else target is `app/<page>/page.tsx` + `app/<page>/page.module.css`.
   - Rewrite the import line in the TSX to `./page.module.css`.
   - Rewrite asset references (`./assets/...` → `/assets/...`) in
     both TSX and CSS — text replace.
   - Write to the temp dir at the new path.
3. Generate `app/layout.tsx`, `next.config.ts`, `package.json` in the
   temp dir.
4. Copy any contents of `<project>/assets/` into the temp dir at
   `public/assets/`.
5. Update `agent.md` with the new template.
6. **Swap**: move all original `*.tsx`/`*.module.css` and `assets/`
   into a sibling `<project>/.scamp-backup-<timestamp>/` dir, then
   move the temp-dir contents into the project root. (Pure rename
   ops — fast, atomic on the same filesystem.)
7. Update the project's recent-projects entry: `format = 'nextjs'`.
8. On any failure before step 6: delete the temp dir, leave the
   project untouched, return an error.
9. Backup is kept on disk for one week (or until next migration of a
   different project) so the user can recover if something looks
   wrong. We'll surface the path in a confirmation toast: *"Migrated.
   Original files saved to .scamp-backup-... in case you need them."*

Atomicity isn't perfect — between step 6's first and last rename we
*could* crash. The backup directory is the recovery path. Document
this in a code comment on the migrator.

### What doesn't migrate

- **`scamp.config.json`** — stays at project root, untouched.
- **`theme.css`** — stays at project root (see Q1).
- **Any non-`.tsx`/`.module.css` files at project root** — left in
  place. Surface a warning in the migration result if any are found,
  so the user can decide whether to move them manually.

---

## `agent.md` template for new (and migrated) projects

The current `AGENT_MD_CONTENT` documents the flat layout. For nextjs
projects it needs:

- **Project structure** section rewritten to describe `app/page.tsx`,
  `app/<page>/page.tsx`, `public/assets/`, and the auto-generated
  `app/layout.tsx` / `next.config.ts` / `package.json` with explicit
  "do not modify" notes.
- **Image references** updated: `<img src="/assets/hero.png" />`,
  `background: url('/assets/hero.png')`.
- **What NOT to change** updated to include `app/layout.tsx`,
  `next.config.ts`, `package.json`.

Approach: split `agentMd.ts` into two exports (`AGENT_MD_CONTENT_LEGACY`
and `AGENT_MD_CONTENT`), keep both in the codebase. Project create
writes the new one; migration overwrites with the new one. Old projects
that haven't migrated keep the legacy text.

---

## Implementation phases

### Phase 1 — Types and detection (no behaviour change yet)

1. Add `ProjectFormat` to `src/shared/types.ts`. Add `format` to
   `ProjectData` and `RecentProject`.
2. Backfill reader in `recentProjects.ts`: if an entry has no `format`,
   default to `'legacy'`.
3. Detection helper in `project.ts`: `detectProjectFormat(path)` →
   `'legacy' | 'nextjs'`.
4. `readProject` returns the detected format alongside the existing
   page list. No layout change yet — every existing project is
   `legacy`, and detection just confirms it.
5. Renderer: thread `project.format` through `App.tsx` →
   `ProjectShell` so downstream components can branch.

**Acceptance:** opening any existing project shows
`format: 'legacy'` in `ProjectData`; new (empty) folders show
`format: 'nextjs'`.

### Phase 2 — Fork pure functions (legacy + new)

1. Rename current `generateCode` → `generateCodeLegacy`. Same for
   `parseCode`. Add a thin re-export so existing imports keep working
   during the transition.
2. Write new `generateCode` / `parseCode` for the nextjs format —
   diff is the import line and asset-reference rewriting. Reuse the
   shared helpers (`DEFAULT_RECT_STYLES`, `cssToScampProperty`,
   breakpoint emit/parse, etc.) — these are format-agnostic.
3. Tests: copy `generateCode.test.ts` → `generateCodeLegacy.test.ts`,
   write a new test file asserting the round-trip invariant for the
   new format. Same for `parseCode`.
4. `syncBridge` in the renderer picks the right pair based on
   `project.format`.

**Acceptance:** all existing legacy unit tests pass against
`*Legacy` versions. New tests pass for the nextjs versions. Round-trip
invariants hold for both.

### Phase 3 — Project create writes the new layout

1. Refactor `createProject` to call a new `scaffoldNextjsProject`
   helper that writes `app/`, `public/assets/`, `package.json`,
   `next.config.ts`, `app/layout.tsx`, plus the home page in nextjs
   form.
2. Keep a `scaffoldLegacyProject` helper around (used only by the
   migrator's tests / not from production code) — this keeps the
   legacy-write code path testable without checking in legacy
   fixtures separately.
3. Update `agentMd.ts` to export both templates; new projects get the
   nextjs one.
4. Bump watcher depth to 3.
5. Integration test: `project:create` produces the exact file tree
   from the user story, opens cleanly, and round-trips through
   `generateCode` → file write → `parseCode`.

**Acceptance:** creating a new project from the start screen produces
the nextjs layout. Adding a rectangle on the canvas saves to
`app/page.tsx` and `app/page.module.css`.

### Phase 4 — Page operations for nextjs

1. Refactor `page:create`, `page:delete`, `page:duplicate`,
   `page:rename` to dispatch on the project's format. Add a small
   main-side `projectFormatCache: Map<string, ProjectFormat>`
   populated by `project:open` and `project:create`, cleared on
   close.
2. Implement nextjs variants:
   - `app/<name>/` folder ops, `page.tsx` + `page.module.css` inside.
   - Component-name rewrite the same as today.
   - No CSS-module import rewrite on duplicate/rename in nextjs
     (always `./page.module.css`).
3. Tests for each handler in both formats.

**Acceptance:** all four page operations work in a freshly created
nextjs project AND in an existing legacy project, with no UI
regression.

### Phase 5 — Image copy for nextjs

1. `copyImage` looks up project format from the cache. For nextjs:
   target `<project>/public/assets/`, return `/assets/<file>`. For
   legacy: unchanged.
2. Update the renderer's image-insertion code path so it doesn't
   prepend `./` to the returned `relativePath` when the format is
   nextjs (the path is already absolute server-root).
3. Test: in a nextjs project, dropping an image lands in
   `public/assets/` and the resulting `<img>` references `/assets/...`
   verbatim.

**Acceptance:** images work end-to-end in both formats.

### Phase 6 — Migration banner + migrator

1. New IPC `project:migrate` with the atomic flow described above.
2. `NextjsMigrationBanner` component: shown on legacy projects, hidden
   on nextjs, hidden on legacy if `scamp.config.json` flags it
   dismissed.
3. Confirmation dialog before migration runs (reuses
   `ConfirmDialog`): *"Migrate &lt;project&gt; to Next.js format? Original
   files will be saved to a backup folder."*
4. After migration: the renderer reloads the project (existing
   project-reload code path), the banner disappears, the recent-
   projects entry is updated.
5. Tests: integration tests against fixture legacy projects covering:
   - Single page (`home`) → migrates correctly.
   - Multi-page (`home` + `about` + `dashboard`) → all migrate, all
     round-trip.
   - Project with `assets/` → moves to `public/assets/` with
     references rewritten in both TSX and CSS.
   - Project with hand-written `customMediaBlocks` → preserved.
   - Failure mid-migration → temp dir cleaned, original untouched.

**Acceptance:** clicking the banner on a legacy project results in a
working nextjs project with all pages and assets intact.

### Phase 7 — Polish + cleanup

- Sidebar tweaks if any (the user story implies none — pages list
  unchanged, root labelled "Home" as today).
- Document the new format in `prd-scamp-poc.md`.
- Add a CONTRIBUTING.md note about the legacy/nextjs split and when
  it's safe to delete `*Legacy`.
- Add a backlog entry to revisit `*Legacy` deletion once telemetry
  (or vibes) suggest most projects have migrated.

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `ProjectFormat`, extend `ProjectData` and `RecentProject` |
| `src/shared/ipcChannels.ts` | Add `ProjectMigrate` |
| `src/shared/agentMd.ts` | Add `AGENT_MD_CONTENT` (nextjs) and rename current content to `AGENT_MD_CONTENT_LEGACY`. Keep `defaultPageTsx` (parameterised). Add scaffold helpers (`defaultLayoutTsx`, `defaultNextConfig`, `defaultPackageJson`) |
| `src/main/ipc/project.ts` | Detection logic, dispatch `readProject`/`createProject` by format, format cache |
| `src/main/ipc/page.ts` | Fork into `*Nextjs` and `*Legacy` handlers; dispatch by format |
| `src/main/ipc/pageRename.ts` | Same fork |
| `src/main/ipc/image.ts` | Path/return value depends on format |
| `src/main/ipc/migrate.ts` | NEW — the atomic migrator |
| `src/main/ipc/recentProjects.ts` | Backfill `format` on read |
| `src/main/watcher.ts` | Bump `depth: 1` → `depth: 3` |
| `src/main/index.ts` | Register migrate IPC |
| `src/preload/index.ts` | Expose `migrateProject` |
| `src/renderer/lib/generateCode.ts` | New nextjs-format implementation |
| `src/renderer/lib/generateCodeLegacy.ts` | NEW — current implementation, renamed |
| `src/renderer/lib/parseCode.ts` | New nextjs-format implementation |
| `src/renderer/lib/parseCodeLegacy.ts` | NEW |
| `src/renderer/src/syncBridge.ts` | Pick generate/parse pair by `project.format` |
| `src/renderer/src/components/NextjsMigrationBanner.tsx` | NEW |
| `src/renderer/src/components/NextjsMigrationBanner.module.css` | NEW |
| `src/renderer/src/components/ProjectShell.tsx` | Mount banner when format is legacy |
| `src/renderer/src/App.tsx` | Reload project after migration |
| `test/generateCode.test.ts` | Targets new (nextjs) format |
| `test/generateCodeLegacy.test.ts` | NEW — copy of current tests |
| `test/parseCode.test.ts` | Targets new format |
| `test/parseCodeLegacy.test.ts` | NEW |
| `test/integration/migration.integration.test.ts` | NEW — fixture legacy project → migrate → assert layout + round-trip |
| `test/integration/sync.integration.test.ts` | Add nextjs-format case alongside the legacy one |

---

## Open questions (please review)

**Q1. Where does `theme.css` live in the new format?**
Two options:
- **(a) Keep at project root** (matches today, easy migration, but it's
  not imported from `app/layout.tsx` so a real `next dev` won't apply
  the tokens).
- **(b) Move to `app/theme.css`** and import it from `app/layout.tsx`.
  This is what makes the tokens actually work outside Scamp when the
  user runs `next dev`. The Scamp canvas doesn't care which path
  it's at — only `theme:read`/`theme:write` need updating. lets go with B.

I'd lean **(b)** because the whole point of this work is "drop into a
real Next.js app and it just works." But (b) is a slightly bigger
migration step (move file + update layout import). Worth confirming
before I commit to it.

**Q2. Does `package.json` get pinned versions or `latest`?**
Pinned (e.g. `"next": "^15.0.0"`) is the saner default — `latest`
guarantees breakage eventually. Confirming you'd rather pin than chase
the bleeding edge. lets go with pinned.

**Q3. `scamp.config.json` location**
Stays at project root (alongside `next.config.ts`). It's a
Scamp-internal file and doesn't need to be inside `app/`. The
`agent.md` template already says "do not modify" — that carries
forward unchanged. agreed.

**Q4. `format` cache vs. carrying `format` on every IPC payload**
Plan above proposes a main-side cache populated at `project:open`.
The alternative is to pass `format` in every `Page*Args` /
`CopyImageArgs`. Cache is fewer places to forget; the trade-off is
one piece of mutable main-side state. I'd go with the cache. Easy to
swap later if it bites. ok lets go with cache.

**Q5. Do we need a "force re-detect" path?**
If a user manually moves files around to convert to nextjs without
the migrator, the cached format goes stale. Not a real workflow we
support, but the cache should be cleared on every `project:open` so
the next open always re-detects. (Cheap: one `fs.access` per open.) sounds good.

---

## Out of scope

- **Preview mode** (`next dev` integration, embedded dev server, HMR,
  the existing Vite-based preview replacement). Tracked separately;
  this plan deliberately stops at "the on-disk layout is right."
- **Deprecating the legacy format.** We'll revisit once most active
  projects have migrated.
- **Auto-migrating on open.** Migration is opt-in via the banner —
  never silent.
- **Multi-route segments / dynamic routes / route groups
  (`(group)/`, `[id]/`, etc.).** Pages are still flat-named folders
  inside `app/`. Adding nesting is a separate story.
- **Importing existing Next.js projects into Scamp.** We assume Scamp
  created the project. Detection on a hand-rolled Next.js app might
  succeed but isn't a supported flow.
- **Sidebar / pages-panel UX changes.** The pages panel works exactly
  as today — the format change is invisible to the user.

---

## Risks

- **Watcher depth.** Bumping `depth` from 1 to 3 widens chokidar's
  scope. On large projects with `node_modules` (which `next install`
  will eventually create), this could thrash. Mitigation: keep the
  existing `ignored: /(^|[\/\\])\../` regex and add an explicit
  `node_modules` ignore.
- **Atomic migration.** Move-rename is atomic per call but the
  multi-step sequence isn't. The backup directory is the recovery
  path; we need to make sure it ALWAYS gets created before any
  destructive op, and we surface its location to the user.
- **Asset-path rewriting.** Naive text replace of `./assets/`
  could mis-match a user-authored string that happens to contain that
  substring (e.g. inside a comment or an unrelated string literal).
  Mitigation: only rewrite inside `url(...)` and `src=` / `srcSet=`
  attribute contexts, not blindly.
- **Legacy `parseCode` regex divergence.** The current parser's
  import-line regex uses the page slug. Forking into `parseCodeLegacy`
  isolates that, but I need to be careful that the new parser doesn't
  silently fall back to legacy behaviour if an import line in the new
  format is malformed — it should fail loud.
- **`recentProjects.json` schema bump.** Existing entries lack
  `format`. The reader backfills `'legacy'`, which is correct for any
  project that predates this change. New entries from this version
  forward always carry the field.
- **Two parallel implementations is more code.** Worth it for the
  clarity of "this is the legacy path, deletable later," but the cost
  is real. We should resist the temptation to keep growing both — bug
  fixes go into the new path; legacy is in maintenance mode.
