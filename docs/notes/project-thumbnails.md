---
title: Start-screen project thumbnails
related:
  - src/renderer/lib/thumbnailCrop.ts
  - src/renderer/src/lib/projectThumbnail.ts
  - src/renderer/src/syncBridge/writeIfDirty.ts
  - src/renderer/src/components/startScreen/ProjectCardThumb.tsx
  - src/main/ipc/projectThumbnailOps.ts
---

# Start-screen project thumbnails

Every successful save of a project's **home** page captures the canvas,
crops it to the card aspect, and writes `<projectPath>/.scamp/preview.png`.
The start-screen cards render it above the project name. Projects with no
thumbnail show their `cardBackground` colour in the same space, so the grid
stays even.

This is the component-sidebar thumbnail pipeline
(`docs/notes/components-thumbnails.md`) one level up, with two differences:
it crops, and it only fires for one page.

## Why on save, not on close

The original idea was to capture when the project closes, so the card
always reflects the latest state. Two problems, both settled in
`docs/plans/project-thumbnails-plan.md`:

- **`onClose` is not the only exit.** It fires only when you click Close
  and land back on the start screen. Quitting with a project open
  (Cmd/Ctrl+Q, closing the window, a crash) goes through main's
  `before-quit` and never touches the renderer. Someone who always quits
  directly would never get a thumbnail, with nothing to explain why.
- **Capture is async; closing unmounts the canvas.** `App.tsx`'s `onClose`
  calls `setProject(null)` immediately. `html-to-image` clones the subtree,
  inlines fonts, and rasterises through an SVG data URL before it resolves.
  Tearing the canvas down mid-flight yields blank or partial images —
  intermittently, which is the worst kind to debug.

Capturing on save sidesteps both: nothing is unmounting, and every exit
path keeps the last good thumbnail. The thumbnail is at most one save
behind, which is a stronger freshness guarantee than "as of last close"
anyway.

## Why the home page only

The card's job is recognition. A project should look like itself on the
start screen, not like whichever page you happened to stop on. So
`captureAndPersistProjectThumbnail` returns immediately unless the saved
page is named `home` (`app/page.tsx`, keyed `'home'` internally).

The consequence: a session spent entirely on `pricing` leaves the card
showing an older home page. That is the intended trade — a stale but
recognisable card beats a fresh but arbitrary one.

## Cropping, not squashing

A page capture is often 1200 wide and several thousand tall; a card is a
16:10 rectangle. Scaling the whole page into that strip produces an
unreadable smear, so `@lib/thumbnailCrop` takes the **full width, from the
top**, cut off at the card aspect.

Horizontal cropping never happens — cutting the sides off a page loses the
layout, which is the thing the thumbnail exists to show. A page *shorter*
than the card aspect is therefore drawn at the top with its own background
colour painted below it, which is what a short page looks like in a
browser too.

Stored at 640px wide (2× the widest a card gets, since the grid is
`minmax(220px, 1fr)`) and never upscaled — enlarging a raster only costs
bytes.

`THUMBNAIL_ASPECT` in `thumbnailCrop.ts` and the `aspect-ratio` in
`ProjectCardThumb.module.css` must agree. If they drift, the image
letterboxes inside its own frame.

## Capture must not touch the live canvas

`capturePng` (the export path) mutates the real DOM while it works: it
resets the frame's `transform` and strips selection classes, restoring both
afterwards. That is invisible for an export the user asked for and waits
on. It is very visible on every save — `Viewport.measureFrame` recovers the
applied zoom from `getBoundingClientRect().width / offsetWidth`, so
blanking the transform makes the canvas jump to 100% and back on every
edit, and the selection outline flickers with it.

`captureIsolatedPng` clones the frame instead, fixes the clone up
off-screen with `transform: none`, and rasterises that. The clone keeps
`data-scamp-canvas` and the frame's inline theme custom properties, so the
`@scope`d page stylesheet and every `var(--…)` resolve as they do on the
real canvas.

Two consequences worth knowing:

- The clone is created and detached **synchronously**, so a capture
  started immediately before the canvas unmounts still completes. That is
  what makes `flushPendingProjectThumbnail` safe to call from `onClose`.
- Captures are debounced 1500ms after the last save
  (`CAPTURE_IDLE_MS`). Rasterising a whole page on every 200ms save
  debounce is far more work than a thumbnail is worth, and it competes
  with the canvas for the main thread — felt as jerky zooming and dragging.

The component thumbnail path still uses the mutating `capturePng` and has
the same flicker on component saves. Not fixed here, but it is the same
bug and `captureIsolatedPng` is the fix.

## Freshness and the file watcher

The watcher ignores dotfile paths, so writing `.scamp/preview.png` fires no
`file:changed` and triggers no project re-read. Unlike component
thumbnails, no custom event is needed to refresh the UI: the start screen
is not mounted while the project is open, so it reads the thumbnail fresh
every time it appears.

## What is deliberately not done

- **No backfill.** Projects that predate this feature show their
  placeholder until they are next opened and their home page saved.
  Generating thumbnails for every project on the start screen would mean
  opening and rendering each one — a lot of work for a picture.
- **No deletion on "remove from list".** The thumbnail lives inside the
  user's project folder. Removing a project from the start-screen list is
  a Scamp-side act; it should not reach into their files.
- **Not shared between machines.** `.scamp/` is gitignored, so a cloned
  project shows its placeholder until opened and saved locally. A
  screenshot is a local cache, not project source.
