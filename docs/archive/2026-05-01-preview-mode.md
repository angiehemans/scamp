# Preview Mode — Plan

**Status:** Draft for review.
**Date:** 2026-05-01
**Source:** `docs/backlog-3.md` story #5
**Related:** Next.js file structure (shipped — replaced the original
Vite assumption), per-element states (#3, shipped), CSS animations
(#4, shipped). Preview is the natural place for those features to
become *fully testable*.

## Goal

Open a real running version of the user's project in a separate
window so they can interact with hover / focus / animations / page
links the way an end-user would. The preview is a real React app —
not a simulation, not a TSX-to-HTML conversion.

---

## Current state — what we can build on

A lot has changed since the story was written. The relevant deltas:

- **Project format is now Next.js App Router by default.** New
  projects get `package.json` (with pinned `next`, `react`,
  `react-dom` deps), `next.config.ts`, and `app/layout.tsx` written
  by the scaffold (Phase 3 of the file-structure project). The
  story assumed Vite + a hand-rolled scaffold; we get most of that
  for free now, just pointed at `next dev` instead.
- **Legacy projects** (flat layout) don't have a `package.json` and
  can't run `next dev` directly. The migration banner already
  exists; preview mode gates on `format === 'nextjs'`.
- **Process spawning** infrastructure exists in
  `src/main/ipc/terminal.ts` via `node-pty`. The dev-server
  spawning here uses plain `child_process.spawn` rather than pty —
  we don't need a TTY for the dev server, just stdout/stderr
  streaming and lifecycle control.
- **Project-format cache** (`projectFormatCache.ts`) is already
  threaded through main; preview can read it without re-detecting.
- **The IPC channel registry** (`src/shared/ipcChannels.ts`) is the
  pattern for new channels — never hardcode names.

What's NOT there yet:

- No window-creation pathway other than the main app window in
  `src/main/index.ts`.
- No long-running child-process management.
- No port-allocation helper.
- No way for the renderer to know which preview windows are open
  (state shared between main and renderer).

---

## Non-goals for this story

- **Vite shim for legacy projects.** The story originally proposed
  a Vite-based preview, but Next.js is now the canonical scaffold.
  Preview is gated on `format === 'nextjs'`; legacy users see the
  existing migration banner with a "Migrate to enable preview"
  hint.
- **Embedded browser with full back/forward history navigation
  through the user's app.** The preview window has a back/forward
  pair that walks an internal history stack of pages the user has
  visited *via Scamp's page switcher* — not full
  `webContents.history` traversal. Real in-app navigation links
  (story #6) work via Next.js routing and don't pollute Scamp's
  history.
- **Hot module reload tuning.** `next dev` ships with HMR; we
  don't add anything on top. The story says "HMR means file
  changes appear in the preview in milliseconds" — that's literally
  what `next dev` does, no extra wiring needed.
- **`prefers-reduced-motion`, accessibility audits, lighthouse
  integration.** Power-user features, separate stories.
- **Multiple simultaneous previews of different pages from the
  same project.** One preview window per project. The viewport-
  width selector is the only way to compare layouts.
- **Auto-reload of the preview when `package.json` changes.** That
  requires re-installing deps; we ship a manual restart button
  instead.
- **Production build / preview** (`next build && next start`). The
  preview is dev-server only.

---

## Decisions worth flagging up front

### "Preview" means `next dev` against the project folder

Not a static render, not `next build`. The preview window navigates
to `http://localhost:<port>/<page-route>` and the browser handles
everything from there. Real React, real CSS modules, real animation
playback, real `:hover` events.

### The window is a custom-chrome `BrowserWindow` with a `<webview>`

Two parts to the preview UI:

1. **Custom toolbar** — back / forward / refresh / viewport-width
   selector / current-route URL bar. Built as React inside the
   preview window's renderer.
2. **App view** — an Electron `<webview>` tag pointed at the dev
   server URL. Webview gives us a sandboxed render surface that the
   user can interact with normally; we can still call
   `webview.reload()`, `webview.goBack()`, etc. from our toolbar.

A `<webview>` (rather than navigating the BrowserWindow itself)
keeps the toolbar UI alive across navigations and gives us a clean
boundary between "Scamp chrome" and "user's app."

### Process management uses `child_process.spawn`, not node-pty

The dev server doesn't need a TTY. Plain `spawn` gives us:
- Stream stdout / stderr to logs
- Detect server-ready signal (parsing for `Local: http://localhost:NNNN`)
- Kill the process cleanly on window close
- Exit code reporting on crash

Node-pty would work too but adds complexity (terminal emulation,
shell quoting) for no benefit.

### One dev server per project, kept alive across window opens

Closing the preview window doesn't kill the server unless the user
explicitly closes the project. Reopening preview reuses the running
server — fast. The server stops when:
- The user closes the project (returns to start screen)
- The user explicitly clicks "Stop server" (admin escape hatch)
- Scamp itself quits

### Mock data via `[page-name].data.json` is deferred

The story includes `[page-name].data.json` injected as props, but
this is conceptually significant work in the Next.js layout because
pages are server components by default and the injection mechanism
differs from Vite. Recommendation: ship preview without mock data
this story; add a follow-up entry in the backlog. The convention
file path stays so we don't break it later.

---

## High-level architecture

```
┌────────────────────────────────────────────────────────────┐
│  Main process (Electron)                                   │
│                                                            │
│  ┌──────────────────────┐   ┌────────────────────────┐    │
│  │ devServerManager.ts  │──▶│  child_process.spawn   │    │
│  │  - per-project Map   │   │  npm run dev           │    │
│  │  - port allocation   │   │  (`next dev -p <port>`)│    │
│  │  - lifecycle         │   └────────────────────────┘    │
│  └──────────────────────┘                                  │
│            ▲                                               │
│            │ IPC: preview:start / stop / status            │
│            ▼                                               │
│  ┌──────────────────────┐                                  │
│  │ previewWindow.ts     │                                  │
│  │  - BrowserWindow     │                                  │
│  │  - one per project   │                                  │
│  └──────────────────────┘                                  │
└────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  Preview window (Electron BrowserWindow renderer)          │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Toolbar: ← → ↺ [/dashboard] [Mobile/Tablet/…]      │    │
│  ├────────────────────────────────────────────────────┤    │
│  │                                                    │    │
│  │   <webview src="http://localhost:PORT/dashboard">  │    │
│  │                                                    │    │
│  │     User's real React app runs here                │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

Two new entry points to write — `devServerManager.ts` and
`previewWindow.ts` — plus a small React app for the preview
window's chrome (separate `index.html` entry).

---

## Detailed design

### Main process — dev server manager

```ts
// src/main/devServerManager.ts

type DevServerStatus =
  | { kind: 'idle' }
  | { kind: 'installing'; logs: string[] }
  | { kind: 'starting'; port: number; logs: string[] }
  | { kind: 'ready'; port: number; logs: string[] }
  | { kind: 'crashed'; logs: string[]; exitCode: number };

type DevServer = {
  projectPath: string;
  status: DevServerStatus;
  process: ChildProcess | null;
  // Subscribers to status changes — used by previewWindow to
  // update its UI as install / start / ready transitions happen.
  listeners: Set<(s: DevServerStatus) => void>;
};
```

Functions:

- `ensureDevServer(projectPath: string): Promise<DevServer>` — looks
  up the existing entry, or creates one. If `node_modules` is
  missing, runs `npm install` first (status `installing`). Then
  picks a free port, spawns `npm run dev -- -p <port>` (or `next
  dev -p <port>` if we install the binary directly), and waits for
  the ready signal.
- `getDevServer(projectPath): DevServer | undefined`
- `stopDevServer(projectPath): Promise<void>` — kills the process,
  removes the entry.
- `subscribe(projectPath, listener): () => void` — for the preview
  window to react to status changes.

Detecting "ready":
- Spawn captures stdout. We watch for the canonical `next dev` line
  (`✓ Ready in <ms>` or `- Local: http://localhost:NNNN`).
- Once seen, transition status to `ready` with the port in scope.
- If the process exits before ready, status becomes `crashed`.

Port allocation:
- Use Node's net module: open an ephemeral listener on `127.0.0.1:0`,
  read the port assigned, close the listener, hand the port to next.
- Race-free enough for our purposes (the gap between close and
  spawn is tiny; if it loses, we retry once).

Process termination:
- `process.kill('SIGTERM')`, fall back to SIGKILL after 2s.
- On macOS / Linux: works directly.
- On Windows: `next dev` spawns child processes (the actual webpack
  worker) — we use `tree-kill` (existing dep, or add it) so the
  tree dies with the parent.

### Main process — preview window

```ts
// src/main/previewWindow.ts

const previewWindows = new Map<string, BrowserWindow>();

export const openPreviewWindow = async (projectPath: string, initialPageName: string): Promise<void> => {
  const existing = previewWindows.get(projectPath);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    // Tell the existing window to navigate to the new page.
    existing.webContents.send(IPC.PreviewNavigate, { pageName: initialPageName });
    return;
  }
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/preview.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      webviewTag: true, // required to host the dev server view
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: true,
    backgroundColor: '#1a1a1a',
  });
  // Load the preview chrome's index.html. Built by electron-vite
  // alongside the main renderer.
  win.loadURL(/* preview renderer entry */);
  previewWindows.set(projectPath, win);
  win.on('closed', () => previewWindows.delete(projectPath));

  // Kick the dev server in parallel — the preview chrome listens
  // for status events and renders accordingly.
  void ensureDevServer(projectPath);
};
```

The preview chrome and the main renderer are separate entry points.
electron-vite's config supports multiple renderer entries.

### Renderer — preview chrome

A small React app in `src/preview/`. Mounts:

```
┌─────────────────────────────────────────────────────────────┐
│ ← →  ↺  [ /dashboard               ]  [ Desktop ▾ ]  ⏹    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   <webview                                                  │
│     src="http://localhost:5173/dashboard"                   │
│     style="width: 1440px; height: 100%"  // viewport sim    │
│   />                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

State held in this renderer:

- `serverStatus` — mirror of `DevServerStatus`, populated via IPC
  events from main.
- `currentRoute` — the URL path the webview is currently showing.
  Updates from `webview.did-navigate`.
- `viewportWidth` — what the user picked from the dropdown.
- `historyIndex` — index into Scamp's tracked history (decoupled
  from `webview.history`; see below).

Status states render different UI:

- `idle` — shouldn't happen if we open the window via
  `openPreviewWindow` (which kicks the server). Defensive: shows
  "Starting server…".
- `installing` — full-bleed message: "Installing dependencies on
  first open…" plus a scrolling log tail.
- `starting` — "Starting dev server on port NNNN…".
- `ready` — chrome + webview, normal interaction.
- `crashed` — error state with logs and a "Restart" button.

### Page → preview URL mapping

The preview's URL bar shows whatever route the webview currently
loads. The mapping from Scamp's page concept to a Next.js route:

- Home page (`app/page.tsx`) → `/`
- `app/<name>/page.tsx` → `/<name>`

Thin and consistent. The preview opens to whichever page the user
was viewing on the canvas when they clicked Preview.

The renderer's "Open Preview" button calls
`window.scamp.openPreview({ projectPath, pageName })`. Main maps
the pageName to a route and tells the existing or new preview
window to navigate.

### Toolbar internals

- **Back / Forward** — drives Scamp's internal history stack, NOT
  the webview's. Webview history is for in-app routing
  (`<Link>` clicks); Scamp history is for page-switcher jumps. The
  user understands "back" as "previous Scamp action," not "previous
  webview navigation." Webview gets `loadURL(url)` for each Scamp
  history step.
- **Refresh** — `webview.reload()`. If the dev server is `crashed`,
  refresh kicks `restartDevServer` instead.
- **URL bar** — read-only display of the current webview URL, with
  a copy button for sharing the link with someone running the
  project locally.
- **Viewport dropdown** — preset widths (390 / 768 / 1440 / 1920 /
  Custom). The webview's wrapper div sets a fixed pixel width and
  the surrounding area scrolls if narrower than the window.
- **Stop server** — admin escape hatch (in an overflow menu, not
  primary). Shuts down the dev server; the next preview open will
  cold-start.

### Mock data — out of scope, file convention reserved

This story does NOT implement the `[page-name].data.json` injection.
Reasons:
- Next.js server components vs client components changes the
  injection mechanism non-trivially.
- The story already mentions it's "the foundation for a future data
  feature" — it's worth a separate design pass.

What we DO ship: the path is reserved. `agent.md` mentions
`[page-name].data.json` is a future-supported convention; agents
shouldn't repurpose the name. We stop short of generating or
parsing the file.

Backlog entry added for the full mock-data injection story.

### Legacy projects

Preview is gated on `format === 'nextjs'`. Legacy projects:

- The Preview button shows but is disabled with a tooltip:
  *"Preview is only available for Next.js-format projects. Migrate
  this project to enable preview."*
- The tooltip links to (or surfaces) the existing migration banner
  if dismissed.

We do NOT generate a Vite scaffold on the fly for legacy projects —
that's a meaningful amount of code for a flow we want users off of
anyway.

### Crash handling

- If the dev server crashes (exit code != 0 before window closes),
  the preview window flips to a "Server crashed" state with the
  last 50 lines of logs visible and a "Restart" button.
- A small unobtrusive log tail is also accessible from an overflow
  menu in the toolbar so the user can grab the output if something
  weird is happening even when the server is "ready."

---

## Implementation phases

### Phase 1 — Dev server manager (no UI)

1. `src/main/devServerManager.ts` — the Map, `ensureDevServer`,
   `stopDevServer`, port allocation, status transitions, log
   capture, ready-detection regex.
2. `src/main/ipc/preview.ts` — IPC handlers for
   `preview:start`, `preview:stop`, `preview:getStatus`. Status
   change events sent via `webContents.send` to listeners.
3. New IPC channel constants in `src/shared/ipcChannels.ts`.
4. Unit tests for the port-allocation helper, the ready-line
   regex, and (as much as is testable) the status state machine.

**Acceptance:** from the main-process devtools, calling
`devServerManager.ensureDevServer('<some nextjs project>')` runs
`npm install` (if needed), spawns `next dev`, transitions through
`installing → starting → ready`, and the URL `http://localhost:PORT/`
loads in a regular browser.

### Phase 2 — Preview window shell (no chrome yet)

1. Add a second renderer entry (`preview`) to
   `electron.vite.config.ts`. Build pipeline produces
   `out/preview/index.html`.
2. `src/main/previewWindow.ts` — `openPreviewWindow`,
   `closePreviewWindow`, the per-project Map, lifecycle hooks.
3. Bare preview renderer (`src/preview/index.html` +
   `src/preview/main.tsx`) — just renders "Preview window — server
   status: <status>" reading from IPC. No webview yet.
4. New preload (`src/preload/preview.ts`) — exposes `onStatusChange`
   and `getStatus`.

**Acceptance:** clicking a temporary "Open Preview" button in the
main app opens a second window that shows the live dev-server
status ticking through `installing → starting → ready` for the
current project.

### Phase 3 — Webview + URL display

1. Mount an Electron `<webview>` in the preview renderer.
2. Once `serverStatus.kind === 'ready'`, set `src` to
   `http://localhost:<port>/<initial-route>`.
3. Listen to `did-navigate` / `did-navigate-in-page` to update the
   URL bar.
4. Add the read-only URL bar component to the chrome.

**Acceptance:** opening preview shows the actual Next.js home page
running. Clicking through in-app links navigates the webview, and
the URL bar updates accordingly.

### Phase 4 — Toolbar (back / forward / refresh / viewport)

1. Back / forward buttons drive Scamp's internal history stack;
   each step calls `webview.loadURL(url)`. Disabled when at the
   ends of the stack.
2. Refresh button: `webview.reload()`; on `crashed`, calls
   `restartDevServer`.
3. Viewport-width segmented control: Mobile (390) / Tablet (768) /
   Desktop (1440) / Custom (number input). Sets the wrapper div's
   pixel width.
4. Custom titlebar styling (titleBarStyle: 'hidden') so the toolbar
   sits flush with the top.

**Acceptance:** every toolbar control behaves as described.

### Phase 5 — Open Preview integration in the main app

1. Toolbar button + `Cmd+P` keyboard shortcut in the main project
   shell.
2. Disabled state for legacy projects with the migration tooltip.
3. Preload exposes `openPreview(args)`; main routes to
   `openPreviewWindow`.
4. When the user switches pages on the canvas while a preview is
   open, the preview navigates the webview to the matching route.
   (Optional polish — the preview already follows `did-navigate` so
   external nav works too.)

**Acceptance:** clicking the toolbar button or pressing `Cmd+P`
opens preview to the currently-active page; subsequent canvas page
switches navigate the webview.

### Phase 6 — Lifecycle + crash UI

1. Preview window close → keep server running.
2. Project close (return to start screen) → kill all dev servers
   for that project path.
3. App quit → kill all dev servers cleanly.
4. Crash UI in the preview renderer: log tail + Restart button.
5. The "Stop server" overflow menu item.

**Acceptance:** dev servers don't outlive their projects; crashes
surface usefully; manual restart works.

### Phase 7 — Polish + docs

- `agent.md` — note that preview is a Scamp feature; the
  `package.json` / `next.config.ts` files exist to support it.
  Mention `[page-name].data.json` as reserved for a future feature.
- `prd-scamp-poc.md` (if it still exists) — describe preview mode.
- `CONTRIBUTING.md` — add a section explaining the preview entry
  point and devServerManager pattern for contributors who need to
  add or extend it.
- Backlog entries: mock data via `[page-name].data.json`;
  production-build preview; Vite shim for legacy projects (only if
  we ever need it).

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/shared/ipcChannels.ts` | Add `PreviewStart`, `PreviewStop`, `PreviewStatus`, `PreviewNavigate`. |
| `src/shared/types.ts` | Add `DevServerStatus` and the IPC payload types. |
| `src/main/devServerManager.ts` | NEW — per-project dev server lifecycle. |
| `src/main/previewWindow.ts` | NEW — per-project BrowserWindow lifecycle. |
| `src/main/ipc/preview.ts` | NEW — IPC handlers wrapping the manager. |
| `src/main/index.ts` | Register `preview` IPC; clean up dev servers on quit. |
| `src/preload/preview.ts` | NEW — preload for the preview window. |
| `src/preview/index.html` | NEW — preview window root. |
| `src/preview/main.tsx` | NEW — preview React entry. |
| `src/preview/PreviewApp.tsx` | NEW — toolbar + webview component. |
| `src/preview/PreviewToolbar.tsx` | NEW — back/forward/refresh/viewport. |
| `src/preview/PreviewToolbar.module.css` | NEW |
| `src/preview/PreviewApp.module.css` | NEW |
| `electron.vite.config.ts` | Add the preview renderer entry. |
| `src/preload/index.ts` | Expose `openPreview` to the main renderer. |
| `src/renderer/src/components/Toolbar.tsx` | Add Preview button + `Cmd+P` shortcut + disabled state for legacy. |
| `src/shared/agentMd.ts` | Note `[page-name].data.json` reservation. |
| `package.json` | Add dev deps: maybe `tree-kill` for clean Windows process trees. |
| `test/devServerStatus.test.ts` | NEW — port helper + ready-line regex. |
| `test/integration/devServerLifecycle.integration.test.ts` | NEW — spawn → ready → kill with a temp project (heavy; gated behind a `SCAMP_TEST_DEV_SERVER` env so CI doesn't have to install Next every run). |

---

## Open questions (please review)

**Q1. Webview vs. Electron BrowserView?**
The plan uses `<webview>` (the deprecated-but-still-shipping
Electron tag) because it's the easiest way to embed a web context
inside a custom-chrome window. The modern alternative is
`BrowserView`, attached to the BrowserWindow with manual bounds
calculations. BrowserView gives slightly better performance and
isn't on Electron's deprecation list. Trade-off: more main-process
coordination. My pick: **webview** for the first ship; BrowserView
is a follow-up if performance bites. Confirming. agreed

**Q2. Always run `npm install` on first open, or require the user
to install manually?**
Plan: auto-install on first open with a progress UI. Dropping the
auto-install and asking users to `npm install` themselves means
the preview button doesn't "just work" out of the box for new
projects, which feels wrong. But auto-install is potentially slow
and noisy. Confirming we should auto-install. yes auto install, we cant assume the user knows to run this. we should have a loading state while auto install runs, like a spinnner.

**Q3. Mock data — really defer to a follow-up?**
The story includes `[page-name].data.json` as a foundational
pattern for a future data feature. My recommendation: reserve the
filename, write a follow-up backlog entry, ship preview without
the injection. Adding it complicates the Next.js page-rendering
strategy (server components vs client components) and the work-
to-value ratio for a "load JSON as props" feature is meaningful
but bounded. Confirming we can defer. yeah this item will be on the next backlog we should defer for now.

**Q4. One preview window per project, or one global preview
window that swaps between projects?**
Plan: one per project. Multiple projects = multiple preview
windows. Simpler mental model; matches how the main app's
project shell works. Cost: more memory per open project. My pick:
**per-project**. Confirming. yes per project.

**Q5. `Cmd+P` is already a common print shortcut. Conflict?**
Within the Scamp window, Cmd+P opening a preview seems fine — we
don't have a print flow. The story names it as the shortcut.
Confirming we keep Cmd+P; can be remapped via the keybindings
plugin later. sounds good.

**Q6. Show / hide chrome on the preview window?**
Plan: custom-chrome BrowserWindow (titleBarStyle: 'hidden') with
our toolbar acting as the title bar. Modern Electron apps go this
way. The traffic-light buttons on macOS still appear in the
top-left courtesy of `titleBarOverlay`. On Windows / Linux, no
window controls overlap our toolbar by default. Confirming. sounds good

---

## Out of scope (recap)

- Vite-based preview for legacy projects.
- Static HTML rendering / `next build` previews.
- Mock data via `[page-name].data.json` (reserved file path only).
- Full webview history navigation through Scamp's back/forward.
- Multiple simultaneous preview windows for the same project.
- Production build, accessibility audits, Lighthouse, etc.
- HMR tuning — `next dev` handles it.
- Auto-reload on `package.json` changes.

---

## Risks

- **First-open latency.** `npm install` for a Next.js project is
  not fast. Even with a clear progress UI, the first preview open
  feels heavy. Mitigation: install runs in parallel with the
  preview window opening so the user sees *something* immediately;
  the install progress is the first thing visible.
- **Process-tree cleanup on Windows.** `next dev` spawns workers;
  killing the parent doesn't always kill children on Windows.
  Mitigation: use `tree-kill` (or `taskkill /T /F`) on Windows.
- **Port conflicts.** Picking a free port via the
  ephemeral-listener trick has a race window between close and
  spawn. Mitigation: retry once on `EADDRINUSE`.
- **Webview tag deprecation.** Electron has been threatening to
  remove `<webview>` for years. Plan does ship with webview; the
  follow-up to BrowserView is in the backlog if/when it actually
  goes away.
- **Scamp's chokidar watcher fighting with `next dev`'s own
  watcher.** Both watch the project folder. They shouldn't
  collide (chokidar reports changes, next responds to file system
  events independently), but worth a manual check that
  `node_modules` doesn't trigger Scamp's watcher (we already
  ignore `node_modules` per the file-structure project — good).
- **Dev-server output clobbering Scamp's logs.** Our captured
  stdout/stderr can balloon; cap to last 1000 lines per server
  and rotate.
- **Cross-window state drift.** The preview chrome listens for
  status changes; if main and preview disagree (e.g. preview
  thinks ready but server died), the user sees stale UI. Mitigation:
  status-change events are the only source of truth; periodic
  polling as a safety net (every 5s).
- **The Preview button being conditional on format adds another
  surface area for "this only works for nextjs."** We already have
  a few of these (image-asset paths, page operations); worth
  consolidating the messaging in one place ("Preview, image
  paths, and the agent.md template are all part of the Next.js
  layout — migrate to enable").
