# Windows atomic-write rename retry

`atomicWrite` (`src/main/ipc/fileOps.ts`) writes to a sibling `.tmp` file
then `fs.rename`s it over the target. On POSIX this is atomic and reliable.

On Windows, `rename` over an existing file intermittently throws `EPERM`
(also seen: `EBUSY`, `EACCES`) because another process holds a transient
handle on the target or the freshly-created `.tmp`:

- chokidar's directory watch handle,
- Windows Defender real-time scanning the new `.tmp`,
- the Windows Search indexer.

This surfaced as flaky e2e failures: a save would throw, the save-status
indicator went to `error` → `reloaded-from-disk`, and `waitForSaved()`
timed out. It hit a different random subset of specs each run because the
lock is a timing race, not deterministic.

## Fix

`renameWithRetry` retries the rename on the transient codes with linear
backoff (20, 40, … ms, up to 10 attempts) — but **only on `win32`**. On
mac/linux `maxAttempts` is 1, so the success path is byte-for-byte
identical to the original single-`rename` behaviour and a failure rethrows
immediately with no added latency.

On a terminal failure (retries exhausted, or a non-transient code) the
orphan `.tmp` is removed before rethrowing, so failed writes don't litter
the project directory. This cleanup runs on all platforms — the pre-fix
code leaked the `.tmp` on any rename failure.
