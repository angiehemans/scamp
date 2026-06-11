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

## Main window — `sandbox: true` ✅

Flipped on (`src/main/index.ts`). With `contextIsolation: true` +
`nodeIntegration: false` already in place, the renderer couldn't
`require()` directly, but `sandbox: true` adds OS-level process isolation
(seccomp/job-object) on top.

Safe to enable because the main preload (`src/preload/index.ts`) is a
pure `contextBridge` + `ipcRenderer` bridge — zero direct Node API usage
(`fs`, `child_process`, `path`, `Buffer`, …). All privileged work
(file IO, node-pty terminals, watcher, image copy) runs in the main
process and is reached over IPC, which is unaffected by the renderer
sandbox. The preload stays CommonJS-compatible, which sandboxed preloads
require.

**Still needs the manual pass** (this can't be verified at build time):
exercise terminal spawn, image insertion, export, and font picker in a
packaged build to confirm nothing in the renderer relied on a
non-sandboxed capability. The flag is one line and trivially reversible
if something surfaces.

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
