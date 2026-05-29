/**
 * Provider-routing helper for pasted font embed snippets. Tries the
 * Google Fonts parser first; falls back to the Adobe Fonts parser;
 * returns a discriminated union the caller switches on.
 *
 * Adding a third provider (Fontshare, Bunny Fonts, self-hosted, etc.)
 * is a matter of:
 *   1. write `parseXxxFontsEmbed` returning the provider's
 *      ParseResult-shaped object
 *   2. extend the `FontEmbedParseResult` union with the new variant
 *   3. add another `if (xxx.ok)` branch below
 */

import {
  parseGoogleFontsEmbed,
  type ParseResult as GoogleParseResult,
} from './googleFontsEmbed';
import {
  parseAdobeFontsEmbed,
  type AdobeParseResult,
} from './adobeFontsEmbed';

export type FontEmbedProvider = 'google' | 'adobe';

export type FontEmbedParseResult =
  | {
      ok: true;
      provider: 'google';
      url: string;
      families: string[];
    }
  | {
      ok: true;
      provider: 'adobe';
      url: string;
      kitId: string;
    }
  | {
      ok: false;
      error: string;
    };

export const parseFontEmbed = (raw: string): FontEmbedParseResult => {
  const google: GoogleParseResult = parseGoogleFontsEmbed(raw);
  if (google.ok) {
    return {
      ok: true,
      provider: 'google',
      url: google.value.url,
      families: google.value.families,
    };
  }
  const adobe: AdobeParseResult = parseAdobeFontsEmbed(raw);
  if (adobe.ok) {
    return {
      ok: true,
      provider: 'adobe',
      url: adobe.value.url,
      kitId: adobe.value.kitId,
    };
  }
  // Neither parser recognised the snippet. Surface a generic error
  // that names both providers so the user knows what we accept.
  return {
    ok: false,
    error:
      "That doesn't look like a Google Fonts or Adobe Fonts embed link. Paste the snippet from your font provider's web project page.",
  };
};
