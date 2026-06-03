# Bisecting the 8 pre-existing Playwright failures

## Background

Between `269d2d8` ("wow all tests passing") and `ff0addf` (current
HEAD as of 2026-06-02), a cluster of Playwright tests started
failing. The var()-in-spacing work in `ff0addf` did NOT introduce
them — running the same 9 tests against `5205d5e` (parent of HEAD)
reproduces identical failures. The 9th — the Google-Fonts
placeholder regex — was fixed in HEAD; the remaining 8 still fail.

Commits in scope, oldest to newest:

```
269d2d8 wow all tests passing
8d33cf9 fixes for file overwrites
f6e5363 fixed cmd-c in components
0cb6f01 overide component text
20538f3 fixed component export issue
5205d5e fixed issue where scamp was overriding agents styles
ff0addf fixed more agent issues and implemented spacing variables   ← HEAD
```

## The 8 remaining failures, grouped by suspected root cause

The failures cluster into two groups based on what they exercise:

### Cluster A — Canvas drop → save path (3 tests)

| Test | What it does |
|---|---|
| `canvas/draw-text.spec.ts:7` | `T + click` places a text element; expect the file to contain `<p data-scamp-id="text_…">` |
| `canvas/draw-image.spec.ts:15` | `I + click` picks an image; expect the file to contain `<img … src="…">` |
| `components/convert-and-place/drag-component-from-sidebar.spec.ts:26` | Drag a component instance from the sidebar onto the canvas; expect the file to contain the import + JSX |

**Symptom:** The element appears in the canvas (its
`data-scamp-id` is queryable) and the save indicator flips to
"Saved", but the file on disk never gets the new element.

**Suspect commits, in order of likelihood:**

1. `5205d5e` "fixed issue where scamp was overriding agents
   styles" — most likely. The fix probably introduced a guard
   that's too aggressive and now blocks legitimate canvas-driven
   saves too.
2. `8d33cf9` "fixes for file overwrites" — adjacent topic. Could
   have changed write semantics in syncBridge.
3. `0cb6f01` / `20538f3` — component-specific commits; could
   affect the drag-component case specifically without touching
   drop-text or drop-image.

### Cluster B — External-edit + chokidar response (4 tests)

| Test | What it does |
|---|---|
| `properties-panel/css-mode.spec.ts:39` | Two sequential Cmd+S edits in the CSS panel; verify both make it to disk |
| `properties-panel/duplicate-indicator.spec.ts:55` | External CSS edit adds a duplicate declaration; size-field edit clears the dot AND collapses the file |
| `undo-redo/external-edit-history.spec.ts:21` | Cmd+Z after an external CSS edit restores the prior width |
| `breakpoints/css-output.spec.ts:57` | External `@media` append round-trips verbatim through subsequent saves |

**Symptom (likely):** A chokidar-routed reload either drops the
in-memory edit or fails to re-trigger the save. All four tests
write CSS externally and then expect either the panel or a
subsequent save to behave correctly against the new disk state.

**Suspect commits:**

1. `5205d5e` "fixed issue where scamp was overriding agents
   styles" — almost certainly the prime suspect; "agent styles"
   = externally-edited CSS, which is exactly the chokidar path.
2. `8d33cf9` "fixes for file overwrites" — file-overwrite
   protection lives in the same engine.

### Standalone — 1 test

| Test | What it does |
|---|---|
| `components/css-edits-in-component.spec.ts:50` | Blur (click outside the component editor) commits CSS edits |

Probably the same cluster-A or cluster-B issue specialised to the
component editor's CSS panel. Could also be a regression in
component editor lifecycle (`5205d5e` or `20538f3`).

## Bisect procedure

Goal: identify the first commit at which Cluster A tests fail and
the first commit at which Cluster B tests fail. They might or
might not be the same commit.

### Tooling

`git bisect` works directly. Each step needs a build + a test run.

Build + test for one commit:

```bash
npm run build && \
  npx playwright test \
    test/e2e/canvas/draw-text.spec.ts:7 \
    test/e2e/canvas/draw-image.spec.ts:15 \
    test/e2e/components/convert-and-place/drag-component-from-sidebar.spec.ts:26 \
  --reporter=line
```

(Drop `npm run build` if you've already built that commit; the
`out/` dir is git-ignored so a fresh checkout always needs a
rebuild.)

For Cluster B, swap the test list:

```bash
npx playwright test \
  test/e2e/properties-panel/css-mode.spec.ts:39 \
  test/e2e/properties-panel/duplicate-indicator.spec.ts:55 \
  test/e2e/undo-redo/external-edit-history.spec.ts:21 \
  test/e2e/breakpoints/css-output.spec.ts:57 \
  --reporter=line
```

### Steps

1. **Confirm `269d2d8` is clean.** Already labelled "wow all tests
   passing" but verify by running both clusters there.
2. **Confirm `ff0addf` (HEAD) is broken.** Already done — 8 fail.
3. **Bisect Cluster A first** — likely the cleaner signal. There
   are 5 commits between the known-good (269d2d8) and known-bad
   (HEAD), so 3 bisect steps will find the culprit:
   - First step: test `0cb6f01` (middle).
   - Second step: depending on result, test `8d33cf9` or
     `20538f3`.
   - Third step: zero in on the boundary.
4. **Bisect Cluster B** in the same range. Likely lands on
   `5205d5e` given the commit message.

### Manual short-cut (if bisect feels overkill)

Both clusters point at `5205d5e` or `8d33cf9`. Just test those two
in order:

```bash
git checkout 8d33cf9 && npm run build && <run all 8 tests>
git checkout 5205d5e && npm run build && <run all 8 tests>
```

If 8d33cf9 passes all 8 and 5205d5e fails some, that pins
clusters to 5205d5e. If 8d33cf9 already fails some, drop further
back. With only 5 commits, walking forward is faster than formal
bisect.

## Once the culprit is identified

For each broken commit, `git show <sha>` and look at the
syncBridge / chokidar / write-path diff. The fix is almost
certainly:

- **Cluster A:** a write-side guard that's catching too much. The
  "overriding agent styles" fix probably blocks writes when an
  agent recently touched the file — but the test scenario has NO
  agent touching the file, so the guard is misfiring on the
  canvas's own write. Look for `externalEditTracker.isPending`
  or `quietWindow.isQuiet` checks added recently.
- **Cluster B:** parse / reload behaviour after an external edit.
  Look for changes to chokidar's `onPageChanged` handler or to
  the post-reload state restoration.

The proper fix in each case should preserve the original intent
of the broken commit (don't clobber agent edits) while letting
the canvas-driven write through. If both invariants can't be
satisfied simultaneously, the test is wrong — but more likely
the guard just needs a `lastWriteAttempt === ourOwn` check.

## What NOT to do

- **Don't revert `5205d5e`.** That commit fixed a real user-facing
  bug — Scamp clobbering hand-edits an agent had made. Reverting
  brings that back.
- **Don't disable the failing tests.** They guard real
  user-facing flows (drop element → save, external edit → reload,
  Cmd+Z after external edit). If something genuinely broke,
  disabling masks it.
- **Don't fold this into the var()-in-spacing PR.** Those
  changes are unrelated; ship them separately so the bisect
  history stays clean.

## Estimated effort

- Bisect run: ~30 min (6 commits, ~5 min each between build +
  test).
- Diff inspection on the culprit commit: ~15 min.
- Fix: hard to estimate without seeing the diff, but the
  pattern (over-aggressive guard) usually needs ~30 min and a
  focused test to pin the new invariant.

Total: ~1.5h to get all 8 passing again, assuming no surprises.
