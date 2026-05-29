---
slug: fonts
summary: How project fonts flow through `theme.css` → store → picker, and the difference between Google and Adobe providers.
related:
  - components-data-model
---

# Project fonts

Project fonts come from two providers and live in a single per-project file. The store keys off the URL list; the picker reads the family list.

## Storage shape

All project fonts are stored as `@import url(...)` lines at the top of `theme.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");
@import url("https://use.typekit.net/abc1def.css");
```

The URL is the source of truth. We never store the family name list on disk — it's always derived. The two derivation paths differ:

| Provider | URL form | Family extraction |
|---|---|---|
| Google | `fonts.googleapis.com/css2?family=Inter&family=Roboto` | Synchronous — parse `?family=` query params (`src/renderer/lib/googleFontsEmbed.ts`) |
| Adobe | `use.typekit.net/<kit-id>.css` | Async — fetch the CSS and read `@font-face` declarations (`src/renderer/lib/adobeFontsFetch.ts`) |

The kit ID is opaque — it tells you nothing about which families are in the kit.

## Renderer-side flow

1. **Parse `theme.css`** — `parseThemeFile` extracts `fontImportUrls: string[]` plus design tokens.
2. **`applyThemeFonts(urls)`** (`src/renderer/src/lib/applyThemeFonts.ts`) — the shared entry point used by both the initial-load path (`ProjectShell.tsx`) and the chokidar handler (`syncBridge.ts onThemeChanged`). It:
   - Routes each URL through `parseFontEmbed` (the dispatcher).
   - Surfaces Google families synchronously and any cached Adobe families immediately into the picker.
   - Kicks off background `fetchAdobeKitFamilies(url)` for every Adobe URL — always re-fetching even if cached, since kits can be edited on Adobe's side between project opens.
3. **Async resolution** — when an Adobe fetch resolves, the resolver writes `kitFamilies[url] = [...]` and re-unions the picker's `projectFonts` list. Failures log to `useAppLogStore.warn(...)` and leave the kit unresolved.
4. **`<link>` injection** — `ProjectShell.tsx` reconciles a `<link rel="stylesheet" data-scamp-font-import="...">` tag per URL in `projectFontUrls`. This is provider-agnostic; the same code path loads either kind.

## Adobe kit caching

`fontsSlice.kitFamilies: Record<string, ReadonlyArray<string>>` is the only Adobe-specific store state. Lifecycle:

- **Add time** — the Fonts panel fetches the kit and writes `kitFamilies[url]` before the URL lands in `theme.css`, so the picker is consistent the instant `setProjectFonts` fires.
- **Project open** — `applyThemeFonts` re-fetches every Adobe URL. The previous session's cached value (if any) acts as a placeholder until the refetch lands.
- **URL removal** — `setProjectFonts` prunes any kit entry whose URL is no longer in the list, so stale cache entries don't leak across projects.
- **Project close** — `ProjectShell` calls `setProjectFonts({ families: [], urls: [] })` which clears the cache too.

The cache is in-memory only. It's NOT persisted to `scamp.config.json` — every cold start re-fetches. (See the original plan's open question #4 for the rationale.)

## Removal semantics

The Fonts panel renders one row per family. Removal differs per provider:

- **Google rows** — `removeFamilyFromUrl(url, family)` rewrites the URL with that family dropped. The other families on the same URL stay. If the removed family was the only one, the whole URL is dropped.
- **Adobe rows** — the kit URL is opaque, so removing ANY family row from an Adobe kit drops the **whole kit** (every family in it). The Remove button's tooltip surfaces this: "Remove kit (removes every family in this Adobe Fonts kit)."
- **Unrecognized rows** — show the bare URL with no family. Removing drops the URL entirely. Used when a kit URL was added but the fetch failed, so the user can clean up without restarting.

## Provider routing

`src/renderer/lib/fontEmbed.ts` is the only place that decides which provider a pasted snippet belongs to. Adding a third provider (Fontshare, Bunny Fonts, self-hosted) is:

1. Write `parseXxxFontsEmbed` returning a typed result.
2. Extend `FontEmbedParseResult` with a new variant.
3. Add the `if (xxx.ok)` branch in `parseFontEmbed`.

Nothing else should need to change.

## Future security note

When the renderer CSP lands (`docs/code-quality-plan.md` Phase 2.3) it needs to allow:

- `style-src https://fonts.googleapis.com https://use.typekit.net`
- `font-src https://fonts.gstatic.com https://use.typekit.net data:`
- `connect-src https://use.typekit.net` (for the kit fetch)

Without the connect-src allowance, the Adobe fetch silently fails and the kit's families never resolve.

## Pitfalls

- **Adobe fetch fails offline** — the kit's `<link>` still attaches (CSS may load from browser cache); only the family list goes empty. Picker shows the URL as an "unrecognized" row until a reconnected refetch lands.
- **A user pasting the same kit twice** — `handleAdd` early-returns with "That font is already added" when the normalized URL matches an existing entry.
- **Re-fetching during navigation** — `applyThemeFonts` runs on every `onThemeChanged` (including the renderer's own writes via chokidar echo). The fetcher is idempotent and short — a duplicate fetch is wasteful but not incorrect. The late-echo guard at `syncBridge.ts:onFileChanged` ensures `theme.css` doesn't re-fire spuriously.
