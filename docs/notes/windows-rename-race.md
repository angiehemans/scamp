---
title: Windows fs.rename EPERM race in atomicWrite
related:
  - src/main/ipc/file.ts
  - src/main/watcher.ts
---

# Windows fs.rename EPERM race in atomicWrite

`atomicWrite` writes a sibling `.tmp` file and `fs.rename`s it onto the target so chokidar / external editors never see a half-written file. On Linux and macOS this is bulletproof: POSIX `rename(2)` happily replaces the destination regardless of who has it open.

On Windows it isn't. `fs.rename` calls `MoveFileExW(MOVEFILE_REPLACE_EXISTING)`, which rejects with `EPERM` (sometimes `EBUSY` or `EACCES`) if anything else holds an open handle on the destination at that instant. Three things in our stack are liable to do exactly that:

1. **Chokidar's `awaitWriteFinish`.** `watcher.ts` configures `stabilityThreshold: 200, pollInterval: 50`, so after any change chokidar polls the destination every 50 ms for the next 200 ms to detect write stability. Each poll opens the file briefly. Hit the rename inside that window and Windows says no.
2. **Windows Defender** scans newly-modified files as soon as the writeFile lands.
3. **Search Indexer** can do the same on user-data dirs.

Symptom: `file:write` rejects with `EPERM: operation not permitted, rename '.../.foo.tmp' -> '.../foo'`, the save-status indicator goes to `error`, and any test that calls `waitForSaved` after that write times out at 10 s. The failing Playwright suite was the obvious surface, but it's a real bug for Windows users — back-to-back edits in the same `awaitWriteFinish` window will hit it intermittently in normal use too.

## The fix

`renameWithRetry` in `src/main/ipc/file.ts` retries on `EPERM`/`EBUSY`/`EACCES` with a linear backoff (20 ms, 50 ms, 80 ms, ... up to 10 attempts). The first attempt almost always succeeds on POSIX, so this is a no-op there. On Windows it covers the full 200 ms `awaitWriteFinish` window plus typical Defender scan jitter.

Other errors (`ENOSPC`, `ENOENT` from a cancelled write, etc.) are re-thrown immediately — we only want to absorb the lock-contention codes, not mask real failures.

## Why not just drop `awaitWriteFinish`?

It debounces external-editor saves and protects the renderer from re-parsing a half-written file. Disabling it would trade one bug for several. Retrying on the writer side is the contained fix.

## Why not write directly without the tmp + rename?

Atomicity is the point. Without the rename step a chokidar `change` event can fire mid-`writeFile`, the renderer reparses partial CSS, and the canvas blows up. The race is in the rename — keep the pattern, retry the rename.
