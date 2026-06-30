# Adobe Fonts (Typekit) Support — Implementation Plan

Goal: let users paste an Adobe Fonts (formerly Typekit) embed link in the same Project Settings → Fonts paste box they already use for Google Fonts, then see each font family listed below — same as the Google flow.

---

## What Adobe Fonts gives users

Adobe's "Web Project" embed dialog gives three forms (we accept the first two, like Google):

```
<link rel="stylesheet" href="https://use.typekit.net/abc1def.css">

@import url("https://use.typekit.net/abc1def.css");

(bare URL)  https://use.typekit.net/abc1def.css
```

The `abc1def` segment is the kit ID. The URL is **opaque** — unlike Google's `?family=Inter&family=Roboto` where families are in query params, a Typekit URL tells you nothing about which families are in the kit. Knowing the families requires fetching the CSS and reading the `@font-face` declarations inside.

The fetched CSS looks like:

```css
@font-face {
  font-family: "source-sans-pro";
  src: url(...) format("woff2"), ...;
  font-display: auto;
  font-style: normal;
  font-weight: 400;
}
@font-face {
  font-family: "playfair-display";
  src: url(...) format("woff2"), ...;
  ...
}
```

That's where we'd extract the family names. The endpoint allows cross-origin reads (no auth, public CSS), so a renderer-side `fetch` works.

---

## Design decisions worth confirming before coding

These shape the implementation; flag any you want to change.

1. **One paste box, both providers.** Same input field; we detect by URL host. Alternative: a segmented control (Google / Adobe). Recommend one box — simpler UX and parallels how the user described it ("the same way").
2. **Family extraction is mandatory.** We always fetch the CSS at add-time to populate the family list. If the fetch fails (offline, 404, blocked), we reject the add with a clear error. Alternative: store the URL with `families: []` and try to resolve later — recommend rejecting at add-time so the user knows immediately.
3. **No per-family removal for Typekit kits.** The kit URL is atomic; removing one family from a kit isn't possible. The list will show one row per family, but every row from the same kit removes the WHOLE kit when clicked. The Google semantics (rewrite URL to drop a family) still applies to Google rows. The Remove button label/tooltip can clarify ("Remove kit" vs "Remove family") on Typekit rows.
4. **Cache families on disk.** The kit's family list is fetched on add and cached in the renderer-side store. On project re-open, we re-fetch each kit URL to refresh families (since kits can be edited on Adobe's side). If the re-fetch fails, we surface the previously-known list with a warning. Alternative: never re-fetch; trust the cache. Recommend re-fetching with a fallback.
5. **No font-family lookup at runtime for rendering.** The injected `<link>` tag already loads the kit's CSS into the document; families are usable in `font-family: ...` declarations the same as Google. So no rendering-pipeline changes are required.
6. **CSP impact.** The eventual renderer CSP (Phase 2 of the code-quality plan) needs to allow `https://use.typekit.net` in `style-src`, `font-src`, AND `connect-src` (for the fetch). Add this to the CSP allowlist when the CSP work lands.

---

## Architecture sketch

Mirror the Google Fonts module structure:

- `src/renderer/lib/adobeFontsEmbed.ts` — new file. Pure parser for the three embed forms. Returns `{ url, kitId }` only; family names come from a separate fetch.
- `src/renderer/lib/adobeFontsFetch.ts` — new file. Async `fetchAdobeKitFamilies(url): Promise<{ families: string[] }>`. Pure with respect to network; takes a URL, returns parsed families. Handles fetch errors with a typed `ParseResult`-style return.
- `src/renderer/lib/fontEmbed.ts` (or extend `googleFontsEmbed.ts`) — small dispatcher that routes a pasted snippet to the right parser by URL host. Returns a discriminated union: `{ provider: 'google' | 'adobe', url, ... }`.
- `src/renderer/store/fontsSlice.ts` — add a kit-families cache so we don't refetch on every render. Schema: `kitFamilies: Record<string, ReadonlyArray<string>>` keyed by URL.
- `src/renderer/src/components/sections/FontsSection.tsx` — extend the row model to know about provider. Add async behavior to `handleAdd` (await fetch for Typekit). Show a per-row "from <Adobe Fonts kit abc1def>" hint and adapt the Remove button.

Nothing else changes. `theme.css` storage is the same `@import` list. The `<link>` injection in `ProjectShell.tsx:338-360` is provider-agnostic.

---

## Phase 1 — Parser + fetcher (pure logic, no UI yet)

**Goal:** ship the unit-testable core. Easy to verify, no UI risk.

### 1.1 `parseAdobeFontsEmbed(raw): ParseResult` — S, Low
File: `src/renderer/lib/adobeFontsEmbed.ts`.

Accept the same three input shapes as Google:
- `<link href="https://use.typekit.net/abc1def.css">`
- `@import url('https://use.typekit.net/abc1def.css');`
- Bare `https://use.typekit.net/abc1def.css`.

Validate:
- Host MUST be `use.typekit.net`.
- Path MUST match `/^\/[a-z0-9]+\.css$/i` (the kit ID).
- Return `{ ok: true, value: { url, kitId } }` on match, `{ ok: false, error }` otherwise.

**Acceptance:** new test file `test/adobeFontsEmbed.test.ts` covers each input shape, host rejection, kit-ID extraction, malformed URLs, whitespace tolerance. Mirrors `test/googleFontsEmbed.test.ts` in shape.

### 1.2 `fetchAdobeKitFamilies(url): Promise<...>` — M, Low
File: `src/renderer/lib/adobeFontsFetch.ts`.

```ts
type FetchResult =
  | { ok: true; families: string[] }
  | { ok: false; error: string };

export const fetchAdobeKitFamilies = async (url: string): Promise<FetchResult> => { ... };
```

Implementation:
- `fetch(url, { cache: 'no-cache' })`. Reject non-2xx with a typed error.
- Read response text.
- Extract every `font-family: "<name>"` declaration inside `@font-face` blocks. Use a focused regex; handle both single and double quotes; dedupe.
- Decode common name conventions (Adobe uses kebab-case slugs; we keep them as-is since that's how users reference them in CSS).
- Return `{ ok: true, families }` (sorted, deduped) or `{ ok: false, error }`.

**Acceptance:** unit test with mocked `fetch` (vitest's `vi.stubGlobal`) covering: real-shaped CSS payload with multiple `@font-face` blocks, single quotes vs double, no `@font-face` (return empty + error), 404 (typed error), network failure (typed error).

### 1.3 Provider-routing helper — S, Low
File: `src/renderer/lib/fontEmbed.ts` (new) OR extend `googleFontsEmbed.ts` (less ceremony).

```ts
export type FontEmbedProvider = 'google' | 'adobe';
export type FontEmbedParseResult =
  | { ok: true; provider: 'google'; url: string; families: string[] }
  | { ok: true; provider: 'adobe'; url: string; kitId: string }
  | { ok: false; error: string };

export const parseFontEmbed = (raw: string): FontEmbedParseResult => { ... };
```

Try the existing Google parser first; on its rejection, try the Adobe parser; if both fail, return a combined error message that names both providers.

**Acceptance:** tests for routing — Google snippet returns `provider: 'google'`, Adobe snippet returns `provider: 'adobe'`, neither shape returns a useful error mentioning both.

---

**Phase 1 total estimate:** half a day. All vitest; no Electron, no UI. Each task is independently shippable.

---

## Phase 2 — Store + cache for kit families

**Goal:** keep the renderer's family list in sync with stored URLs across loads. No UI yet.

### 2.1 Add `kitFamilies` to `fontsSlice` — S, Low
Schema:
```ts
type FontsState = {
  ...existing...
  /** Maps a stored URL to the families resolved for it. Populated
   *  on add (synchronously for Google, async for Adobe) and on
   *  project open via `refreshKitFamilies`. */
  kitFamilies: Record<string, ReadonlyArray<string>>;
  setKitFamilies: (url: string, families: ReadonlyArray<string>) => void;
  clearKitFamilies: () => void;
};
```

Update `setProjectFonts` so closing a project clears `kitFamilies` too.

**Acceptance:** integration test covering set/clear; existing fontsSlice tests still pass.

### 2.2 Project-open resolver — M, Medium
File: `src/renderer/src/syncBridge.ts` (`onThemeChanged` handler) and the initial-load path.

When `theme.css` is parsed and yields a Typekit URL whose families aren't cached:
- Kick off `fetchAdobeKitFamilies(url)` in the background.
- On success, populate `kitFamilies[url]` and append to the union family list used by the picker.
- On failure, log to `useAppLogStore.warn(...)` with the URL and error; leave families empty (UI will surface as "(unresolved)" rows).

For Google URLs the families come from `parseGoogleFontsEmbed` synchronously — no change.

**Acceptance:** unit test the resolver function with mocked fetch. e2e test seeds a `theme.css` with a fake Typekit URL (and a stubbed fetch returning fixture families) and asserts the picker's family list contains them after open.

---

## Phase 3 — UI integration

**Goal:** make the existing paste box accept both providers.

### 3.1 Wire the provider-router into `FontsSection.tsx` `handleAdd` — M, Medium
Replace the direct `parseGoogleFontsEmbed(draft)` call with `parseFontEmbed(draft)`. Switch on `provider`:
- `'google'`: existing flow (families come from the parser).
- `'adobe'`: show a temporary "Fetching kit…" busy state in the input (disable Add). Call `fetchAdobeKitFamilies`. On failure: surface `setError(parsed)` with provider-aware message. On success: persist URL via `writeTheme` and update `kitFamilies[url]`.

**Acceptance:** existing Google-only flow unchanged. Pasting a Typekit URL adds it and surfaces families. Network failure shows a clear inline error and doesn't write `theme.css`.

### 3.2 Row model + per-row remove behaviour — M, Low
Extend `FontRow` to a discriminated union:
```ts
type FontRow =
  | { kind: 'google-family'; family: string; sourceUrl: string }
  | { kind: 'adobe-family'; family: string; sourceUrl: string; kitId: string }
  | { kind: 'unrecognized'; sourceUrl: string };
```

Source-of-truth for adobe families: `kitFamilies[sourceUrl]` from the store. If empty (resolver failed), render an `unrecognized` row showing the kit URL so the user can at least remove it.

Remove semantics:
- `google-family`: existing per-family rewrite via `removeFamilyFromUrl`.
- `adobe-family`: drop the entire kit URL (and clear `kitFamilies[url]`). Confirm with a tooltip on hover: "Remove kit (removes all families from this Adobe Fonts kit)".
- `unrecognized`: existing whole-URL drop.

**Acceptance:** e2e test in `test/e2e/sync/fonts-typekit.spec.ts` seeds a `theme.css` with a Typekit URL, stubs the fetch, adds families, asserts they show as adobe rows, removes one and asserts the whole kit URL is gone from disk (plus all sibling families disappear from the picker).

### 3.3 Visual differentiation — S, Low
Each row gets a small provider tag — "Google" or "Adobe". Optional but very low cost and saves the user a mental round-trip when troubleshooting.

**Acceptance:** rows render the tag. No new tests beyond what 3.2 covers.

---

## Phase 4 — Polish + documentation

### 4.1 Update `agent.md` / `theme.css` doc — S, Low
The user-facing `agent.md` template (`src/shared/agentMd.ts`) explains the `theme.css` file. Add a one-line note that `@import` URLs from `use.typekit.net` are recognized alongside Google's.

**Acceptance:** template diff is minimal; existing scaffold tests pass.

### 4.2 Add a `docs/notes/fonts.md` — S, Low
Short note covering: stored shape, provider differences (URL transparency, async fetch), the kit-families cache, offline behaviour. Useful both for humans and for any future agent task in this area.

### 4.3 CSP allowlist hook — S, Low (depends on the Phase 2 CSP work in `code-quality-plan.md`)
When the renderer CSP lands (code-quality plan Phase 2.3), add `https://use.typekit.net` to `style-src`, `font-src`, and `connect-src`. Until CSP exists, this is a no-op.

**Acceptance:** if CSP is in place, no console violations when adding/loading a Typekit kit.

---

## Phase 5 — Optional follow-ups

These are NOT required for shipping the feature, but worth considering once it lands.

### 5.1 Pre-fill kit family display names from Adobe's CSS comments
Adobe's CSS file sometimes includes the kit name in a top-of-file comment. Parsing that gives a friendlier label ("Kit: My Brand Fonts") than the kit ID. Low priority.

### 5.2 Show font preview text per row
Render each family name in its own font (apply `font-family: <name>`). Works once the `<link>` injection has loaded the kit. Same win as it'd be for Google rows — do both at once.

### 5.3 Detect renamed / removed kits on re-open
If a kit URL was deleted on Adobe's side, the fetch returns 404. Currently we'd just show "(unresolved)". A nicer touch: a one-time toast "This Adobe Fonts kit no longer exists" with a "Remove from project" button. Low priority.

---

## Suggested rollout schedule

| Sprint | Tasks |
|---|---|
| Day 1 | Phase 1 (parser + fetcher + router) |
| Day 1 | Phase 2.1 (store schema) |
| Day 2 | Phase 2.2 (project-open resolver) + Phase 3.1 (paste-add flow) |
| Day 3 | Phase 3.2 (row model + remove) + Phase 3.3 (visual tags) |
| Day 3 | Phase 4.1 (agent.md update) + 4.2 (docs/notes) |
| Later | Phase 4.3 (CSP) when CSP itself lands |
| Later | Phase 5 follow-ups as time allows |

Total: **~3 days** of focused work.

---

## Open questions for your review

1. **One paste box vs two?** Recommend one. Confirm. yes, one
2. **Add-time fetch failure → reject?** Recommend reject (surface error immediately, don't store an unresolved URL). Confirm vs "store anyway and retry later".
3. **Per-row remove semantics for Adobe rows.** Recommend "removing any row from a kit removes the whole kit, with a clear tooltip." Alternative: only show one row per kit (collapsed) labelled with the kit ID and family count. The second is less consistent with Google's per-family view but is more honest about what removal actually does. agreed with rec
4. **Cache families across runs?** Recommend re-fetching on each project open (sources of truth on the network can change). Alternative: persist cached families in `scamp.config.json` and only re-fetch on demand. Confirm. agreed
5. **Should we accept Typekit's older `<script src="use.typekit.net/xxx.js">` form?** That form expects JS execution to inject `<style>` tags. Recommend NOT supporting it — only the modern CSS `<link>` / `@import` forms. The Adobe Fonts UI defaults to the CSS form anyway. agree with rec.
6. **What about other providers** (Fontshare, Bunny Fonts, self-hosted)? Out of scope for this plan, but the dispatcher in 1.3 makes adding a third provider trivial. Worth a follow-up issue once Adobe lands. agreed.
