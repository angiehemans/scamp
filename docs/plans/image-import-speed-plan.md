# Large image imports are too slow — Plan

Status: **implemented** — A, B and C. D (optimistic placement) not built;
try the result first and decide whether it's still wanted.

**After** (same 12MP fixture, plus a 24MP one — your 7MB file is roughly
the latter):

| Image | Before | After | Time | Event-loop ticks during |
|---|---|---|---|---|
| 12MP photo | 3.1MB | 1.71MB | 1453ms | 143 |
| 24MP photo | 6.2MB | 3.42MB | 2580ms | 255 |

The 12MP case went from ~9.2s to ~1.45s — 6.3x — and the app now stays
responsive throughout: the event loop ticked 143 times during an encode
that previously produced exactly zero ticks.

## What's actually happening

Measured on a 12MP (4000×3000) photo saved as a 2.8MB JPEG — smaller
than the 7MB file that prompted this:

| Step | Time | Output |
|---|---|---|
| JPEG decode | 201ms | — |
| WebP encode, lossy q80 | 2276ms | 2.57MB |
| WebP encode, lossless | 6742ms | **7.23MB** |
| **Total** | **~9.2s** | keeps the 2.57MB lossy |

Three separate problems, in increasing order of how bad they are:

### 1. Three quarters of the wait is thrown away

The lossless encode took 6.7s to produce 7.23MB — **larger than the
2.8MB source**, so it loses the comparison and is discarded. On any
photograph it always will: lossless is for flat graphic content. We are
spending most of the import doing work whose result is guaranteed to be
binned.

### 2. We're running the slow encoder by mistake

jsquash's `init` auto-selects the SIMD build when the runtime supports it
— and it does. But we hand it `wasmBinary: webp_enc.wasm`, the *non*-SIMD
binary, which overrides that choice. Pointing at `webp_enc_simd.wasm`
instead is **1.7x faster with byte-identical output** (359ms vs 620ms on
a 3MP image).

### 3. The encode freezes the entire app

WASM runs synchronously on the calling thread. A timer ticking every 10ms
during a 420ms encode got **zero ticks** — the main process event loop is
completely blocked. So for those 9 seconds the app isn't slow, it's
wedged: no IPC, no saves, no file-watcher handling, no window redraw.

This is almost certainly what "took way too long" felt like.

---

## Options

### A. Skip the lossless attempt when it can't win — *small*

Only try lossless for PNG sources under a pixel budget (~4MP). A JPEG is
already lossy, so lossless WebP of one is pointless by construction; a
huge PNG photo loses for the same reason a JPEG does. Flat UI art — where
lossless genuinely wins, and wins big — is small.

Removes ~6.7s of the 9.2s.

### B. Use the SIMD binary — *one line*

Point `wasmBinary` at `webp_enc_simd.wasm`. 1.7x, identical output.

**A and B together take the 12MP import from ~9.2s to ~1.5s.**

### C. Move the encode off the main thread — *medium*

Run it in a `worker_threads` Worker (or an Electron `utilityProcess`).
The app stays fully responsive regardless of image size; the import
itself still takes ~1.5s before the image appears.

Worth doing on its own merits: even 1.5s of a frozen main process is a
visible hitch, and a 24MP image would still be ~3s.

### D. Place the image immediately, convert in the background — *large*

What you asked for. Copy the original (a fast file copy), place the
element referencing it, convert in the background, then swap the
reference to the `.webp` when it lands.

The image appears in ~50ms regardless of size. But the conversion now
finishes *after* the element exists, which means mutating the user's
document asynchronously, and that has real edges:

- **The `src` patch is a document mutation arriving out of nowhere.** Is
  it undoable? A separate history entry would let the user undo "the
  thing they didn't do"; a silent patch means undo skips past it.
- **Undo during conversion.** If the insert is undone while the encode is
  in flight, the swap must find nothing and clean up its orphan file.
- **Page or project switch during conversion**, or quitting the app —
  leaving a `.png` reference and a stray `.webp`, or vice versa.
- **The element may have been copied or duplicated** before the swap, so
  more than one reference needs patching.
- **Two saves and two watcher events** per import instead of one.

None of it is unsolvable, but it's a class of bug that shows up as "my
image reverted" reports much later.

---

## Recommendation

**A + B + C**, and stop there unless it still feels slow.

That's ~1.5s for a 12MP photo with the app fully responsive throughout —
a 6x improvement from two nearly-trivial changes plus a worker. D buys
the remaining 1.5s of perceived latency at the cost of async document
mutation, and I'd rather you feel A+B+C first and decide whether that
last step is worth it.

If you want D regardless, it's cleanest built *on top of* C — the worker
is what makes background conversion safe to run without freezing anything.

---

## Phases

### Phase 1 — A + B
`imageOptimize.ts` only. Point at the SIMD binary; gate the lossless
attempt on source type and pixel count. Extend the integration tests with
a large-image case asserting the lossless path is skipped.

### Phase 2 — C
Move `encodeSmaller` into a worker. The module's public API
(`toWebpIfSmaller` / `bufferToWebpIfSmaller`) doesn't change, so nothing
upstream moves. The worker must fail soft exactly as the codecs do today:
if it can't start, imports proceed uncompressed.

### Phase 3 — D, only if wanted
Optimistic placement, built on the phase-2 worker.

---

## Files to touch

**Phase 1:** `src/main/ipc/imageOptimize.ts`,
`test/integration/imageOptimize.integration.test.ts`.

**Phase 2** turned out to need no new file. electron-vite emits main as
one bundle, so a separate worker entry would have to be located on disk
at runtime — inside the asar when packaged, which is exactly the
works-in-dev-fails-when-packaged trap this feature already hit once. The
worker body is a string passed to `new Worker(src, { eval: true })`
instead: no path to get wrong, and every module and `.wasm` it needs is
resolved by the parent and handed over as an absolute path.

**Shim regen:** both projects. Dev server stopped.

---

## Tests

- a large photo converts without attempting lossless (assert on time or
  by exposing which encodes ran — timing alone is flaky, so the encoder
  should report what it tried)
- a small PNG still tries both and keeps the lossless result when smaller
- the SIMD swap doesn't change output size or dimensions
- **phase 2:** the event loop keeps ticking during an encode — the direct
  regression for the freeze, and the reason to do C at all
- **phase 2:** a worker that fails to start degrades to uncompressed
  imports rather than failing them

---

## Open questions

1. **Is A + B + C enough, or do you want D?** My read is that a
   responsive 1.5s import is fine and D's async document mutation isn't
   worth it — but you're the one who felt the delay, so if instant
   placement is what you actually want, say so and I'll build it on the
   worker.

2. **The lossless pixel budget.** I've proposed 4MP. Above it we always
   go lossy, which for a large flat-colour PNG means a slightly worse
   result than it could have had. Lower is faster and slightly worse for
   big graphics; higher is the reverse.

3. **Should a slow import show any progress?** Right now the picker
   closes and nothing happens until the image appears. Even with C that's
   ~1.5s of silence. A spinner on the canvas would cover it — worth it,
   or noise?
