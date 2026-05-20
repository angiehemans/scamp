# Scamp — Known Issues

Issues we've diagnosed but deliberately not fixed yet. Each entry
explains the symptom, the diagnosed root cause, why the fix is
deferred, and the rough shape the fix will take when we pick it
up.

---

## Concurrent-write race: agent edits clobbered by Scamp's debounced save

**First observed:** 2026-05-17 (development only so far)
**Status:** deferred — collecting more reports before changing the
write path.

### Symptom

You have a Scamp project open. An agent (Claude Code, etc.) edits
one of the project's page files externally. The agent's edits
disappear shortly after — the file on disk reverts to a state from
before the agent's write, and the canvas shows that older state.

### Root cause

A two-writer race between Scamp's debounced auto-save and the
agent's external write. Concretely:

1. `t = 0` — Project is open. Canvas state = X. Disk = X.
   `lastSerialized = X`.
2. `t = 100` — User makes a small canvas tweak in Scamp. State
   moves X → X'. Scamp marks the page unsaved and starts its 200ms
   debounce timer.
3. `t = 150` — Agent writes the file externally with state Y.
   Disk = Y. chokidar's `awaitWriteFinish` (200ms stability) hasn't
   fired yet, so the renderer doesn't know about Y.
4. `t = 300` — Scamp's debounce timer fires
   `flushDebouncedWrite`. It serialises `state.elements` (still X')
   and issues `writeFile(X')`. `atomicWrite` in `file.ts` renames
   a `.tmp` over the destination — **Y is replaced by X' on
   disk**.
5. `t = 350` — chokidar finally fires for the agent's write.
   `emitChange` does `fs.readFile`, which reads the *current* disk
   contents (X', since Scamp just wrote it). The renderer receives
   X', dedupes against its own state X', and treats the event as a
   no-op. The agent's Y is silently lost.

The crucial step is (4): Scamp's write is built on a stale view
of disk (`lastSerialized = X`) and doesn't check whether the disk
has actually moved on before clobbering it.

### Why deferred

- Only observed during Scamp's own development (HMR + dev server
  noise widens the window where in-Scamp edits coincide with
  external agent edits). Not yet seen by users on a packaged
  build.
- The fix changes the IPC contract between renderer and main —
  worth waiting for more reports before committing to a specific
  shape.
- Workaround for now: when working with an agent on a Scamp
  project, avoid touching the canvas while the agent is writing.
  Wait for the agent's edit to settle on disk (`file:changed`
  reloads the canvas) before making your own change.

### Sketch of the eventual fix

Optimistic concurrency control on the write path:

1. Renderer sends `expectedTsxContent` + `expectedCssContent`
   (its `lastSerialized` values) alongside each `writeFile` IPC.
2. Main reads the current disk content before writing. If it
   matches the renderer's expected values, the write proceeds.
   If it doesn't, an external editor wrote between Scamp's last
   sync and now — main rejects the write with a typed
   `ConflictError`.
3. Renderer treats the conflict by dropping its own pending write
   and letting the next `file:changed` event reload the canvas to
   the agent's state. Optionally surface a "the file was edited
   outside Scamp; reloaded to that version" toast so users see
   what happened.

The pre-write read is one extra `fs.readFile` per save — a few
hundred microseconds at most, well inside the debounce budget.

---

## `@sentry/electron` 7.13.0 crashes on renderer scope updates with missing breadcrumbs

**First observed:** 2026-05-17 (during Phase 2 of the components
feature — but the bug is in the dependency, not our code).
**Status:** patched locally via a hand-applied diff to
`node_modules/@sentry/electron/{main,esm/main}/ipc.js` AND
`out/main/index.js`. Patch saved at
`patches/@sentry+electron+7.13.0.patch`. Re-application across
fresh `npm install` is NOT automatic yet — see "Persisting the
patch" below.

### Symptom

Opening a project crashes the renderer immediately: the canvas
won't accept clicks, no toolbar key commands work, the dev
terminal shows:

```
TypeError: Cannot read properties of undefined (reading 'pop')
    at handleScope (.../out/main/index.js:21168:44)
[main] renderer crashed: crashed 139
Error sending from webFrameMain: Render frame was disposed …
[main] renderer became unresponsive
```

### Root cause

`@sentry/electron`'s main-side `handleScope` (in
`main/ipc.js` line 129 in 7.13.0):

```js
const breadcrumb = sentScope.breadcrumbs.pop();
```

There's no defensive check. The renderer-side Sentry sometimes
sends scope payloads with the `breadcrumbs` field omitted; the
unguarded `.pop()` throws `TypeError`. Because the throw is
inside Electron's protocol-handle async, the unhandled exception
takes the renderer process down with it. Chokidar then keeps
trying to message the dead frame, producing the
`Render frame was disposed` follow-on errors.

### Workaround applied

Three files patched in place with `(sentScope.breadcrumbs ?? []).pop()`:

- `node_modules/@sentry/electron/main/ipc.js` (CJS — what main consumes)
- `node_modules/@sentry/electron/esm/main/ipc.js` (ESM — what bundlers pick up)
- `out/main/index.js` (the already-built bundle, so a restart of
  `npm run dev` picks the fix up immediately without a fresh
  `npm run build`)

### Persisting the patch

`node_modules/` patches are wiped on every fresh
`npm install`. To make the fix survive:

1. `npm install --save-dev patch-package`
2. Add `"postinstall": "patch-package"` to `package.json` scripts.
3. Re-run `npm install` once to verify the existing
   `patches/@sentry+electron+7.13.0.patch` re-applies.

Optional: open an upstream PR adding the `?? []` guard to
`@sentry/electron`'s `handleScope`. The fix is two characters;
the test surface is one new "renderer sent partial scope"
case.

---

### Related: late-chokidar echo race

While diagnosing the above, we also identified a separate but
related race: if chokidar fires `change` for a Scamp-initiated
write *after* the main process's 400ms pending-write expiry, the
delayed `file:changed` event reaches the renderer and can clobber
in-memory edits that the user made between the original save and
the late chokidar event.

The simpler fix for that race (also deferred) is a byte-equal
short-circuit in `syncBridge.ts`'s `onFileChanged` handler: if the
incoming payload matches `lastSerialized`, ignore the event — it's
our own write echoing back. Combined with the conflict check
above, the two layers together cover both observed failure modes.
