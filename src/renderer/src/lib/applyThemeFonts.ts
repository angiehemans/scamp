import { parseFontEmbed } from '@lib/fontEmbed';
import { fetchAdobeKitFamilies } from '@lib/adobeFontsFetch';
import { useFontsStore } from '@store/fontsSlice';
import { useAppLogStore } from '@store/appLogSlice';

/**
 * Pump a freshly-parsed `theme.css` font-import list into the
 * fonts store, then kick off async Adobe-kit resolution for any
 * URLs whose families aren't derivable from the URL itself.
 *
 * Google URLs: families come back synchronously from the URL parser
 * and land in the picker immediately.
 *
 * Adobe URLs: only the URL is in `theme.css`; we fetch the kit's CSS
 * to discover the family names, then update the store with the
 * resolved set (which unions with any Google families already
 * present). On fetch failure we log a warning and leave the kit
 * unresolved — the URL stays in `projectFontUrls` so the user can
 * see and remove it via the Fonts panel.
 *
 * The fetch is fire-and-forget; the caller doesn't need to await it.
 * Subsequent calls for already-cached Adobe URLs short-circuit so
 * navigation / file-watcher events don't refetch on every change.
 */
export const applyThemeFonts = (
  urls: ReadonlyArray<string>
): void => {
  // 1. Synchronous pass: derive families that the URL alone reveals.
  // Adobe kits contribute their cached families (from a prior fetch
  // or the same-session add).
  const fontsStore = useFontsStore.getState();
  const cachedKitFamilies = fontsStore.kitFamilies;
  const familiesSoFar: string[] = [];
  const adobeUrlsToResolve: string[] = [];
  for (const url of urls) {
    const parsed = parseFontEmbed(url);
    if (!parsed.ok) continue;
    if (parsed.provider === 'google') {
      for (const f of parsed.families) familiesSoFar.push(f);
    } else {
      // Adobe URL — surface cached families immediately so the picker
      // doesn't flicker while the refetch runs.
      const cached = cachedKitFamilies[url];
      if (cached) {
        for (const f of cached) familiesSoFar.push(f);
      }
      adobeUrlsToResolve.push(url);
    }
  }
  fontsStore.setProjectFonts({ families: familiesSoFar, urls });

  // 2. Async pass: refresh every Adobe kit's families. We always
  // re-fetch (kits can be edited Adobe-side between project opens);
  // cached values acted as a placeholder for the picker while the
  // network call was in flight.
  for (const url of adobeUrlsToResolve) {
    void resolveAdobeKit(url);
  }
};

const resolveAdobeKit = async (url: string): Promise<void> => {
  const result = await fetchAdobeKitFamilies(url);
  if (!result.ok) {
    useAppLogStore
      .getState()
      .log('warn', `Adobe Fonts: couldn't load ${url} — ${result.error}`);
    return;
  }
  const store = useFontsStore.getState();
  store.setKitFamilies(url, result.families);
  // Recompute the union family list: drop the kit's stale entries
  // (handled by setKitFamilies overwriting), then merge fresh.
  const merged = unionFamiliesFromUrls(
    store.projectFontUrls,
    store.kitFamilies
  );
  store.setProjectFonts({
    families: merged,
    urls: store.projectFontUrls,
  });
};

/**
 * Recompute the picker's family list from the current URL list plus
 * the kit-families cache. Exported so callers that mutate URLs (the
 * Fonts panel's add / remove handlers) can stay consistent.
 */
export const unionFamiliesFromUrls = (
  urls: ReadonlyArray<string>,
  kitFamilies: Record<string, ReadonlyArray<string>>
): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const parsed = parseFontEmbed(url);
    if (!parsed.ok) continue;
    if (parsed.provider === 'google') {
      for (const f of parsed.families) {
        const k = f.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(f);
      }
    } else {
      const fams = kitFamilies[url];
      if (!fams) continue;
      for (const f of fams) {
        const k = f.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(f);
      }
    }
  }
  return out;
};
