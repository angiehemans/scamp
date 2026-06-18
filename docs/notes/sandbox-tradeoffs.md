---
title: Renderer sandbox tradeoffs
related:
  - src/main/index.ts
  - src/main/previewWindow.ts
  - src/preload/index.ts
  - src/preload/preview.ts
---

# Renderer sandbox tradeoffs

Status of `webPreferences.sandbox` per window, and why.

## Main window — `sandbox: true` ✅ (with a build-side fix)

On (`src/main/index.ts`). With `contextIsolation: true` +
`nodeIntegration: false` already in place, the renderer can't `require()`
directly; `sandbox: true` adds OS-level process isolation
(seccomp/job-object) on top. Safe because the main preload
(`src/preload/index.ts`) is a pure `contextBridge` + `ipcRenderer` bridge
— zero direct Node API usage; all privileged work (file IO, node-pty
terminals, watcher, image copy) runs in main and is reached over IPC,
which the renderer sandbox doesn't touch.

### The chunk trap (fixed 2026-06-11)
"Pure bridge + CommonJS" is necessary but **not sufficient**. A sandboxed
preload may only `require('electron')` plus a tiny built-in allowlist —
it **cannot `require()` a relative chunk file**. electron-vite builds the
two preloads (`index.ts` + `preview.ts`) together, and their shared
`@shared/ipcChannels` import was hoisted into
`out/preload/chunks/ipcChannels-*.js`, so the emitted `index.js` did
`require("./chunks/…")`. Under sandbox that threw on load,
`exposeInMainWorld('scamp', …)` never ran, `window.scamp` was undefined,
and the app showed a blank screen (cascading into `initSyncBridge` and
the Sentry renderer init).

Fix: the **`inlinePreloadSharedConstants`** plugin in
`electron.vite.config.ts` (preload build only) resolves
`@shared/ipcChannels` to a unique id per importing preload entry, so
Rollup inlines a copy into each preload instead of hoisting a shared
chunk. The CLAUDE.md "never hardcode IPC channel strings" rule blocks the
obvious source-level fix (duplicating the constants in `preview.ts`), so
the de-duplication lives in the build, not the source. Verify after any
preload/build change: `out/preload/index.js` must `require("electron")`
only — no `require("./chunks/…")`.

**Still wants the manual pass** (can't be verified at build time):
exercise terminal spawn, image insertion, export, and font picker in a
packaged build to confirm nothing in the renderer relied on a
non-sandboxed capability.

## Preview window — `sandbox: false` (deferred)

Left off (`src/main/previewWindow.ts`). The preview preload
(`src/preload/preview.ts`) is itself pure IPC and would be sandbox-safe,
but the window also sets `webviewTag: true` and mounts a `<webview>` that
hosts the user's `next dev` app. The `<webview>` + `sandbox: true`
interaction needs real runtime verification that couldn't be done at
edit time, and the security upside is lower here: the preview hosts the
user's own local dev server, not untrusted third-party content, and it is
already isolated from the main app by being a separate window with a
minimal preload.

To flip it later: set `sandbox: true` in `previewWindow.ts`, then
manually verify the dev-server webview still loads, navigates (Cmd+P to a
different page), and recovers from a server restart. If the webview
breaks, revert and record the specific failure here.
