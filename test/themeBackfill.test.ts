import { describe, it, expect } from 'vitest';
import { backfillThemeDefaults } from '../src/shared/themeBackfill';
import {
  BROWSER_RESET_SENTINEL,
  DEFAULT_BODY_FONT_FAMILY,
} from '../src/shared/agentMd';

describe('backfillThemeDefaults', () => {
  describe('--font-sans token', () => {
    it('adds the token to an existing :root rule when missing', () => {
      const input = `:root {
  --color-primary: #3b82f6;
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain('--color-primary: #3b82f6');
      expect(result.content).toContain(`--font-sans: ${DEFAULT_BODY_FONT_FAMILY}`);
    });

    it("doesn't replace an existing --font-sans value", () => {
      const input = `:root {
  --font-sans: 'Inter', sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.content).toContain("--font-sans: 'Inter', sans-serif");
      expect(result.content).not.toContain(DEFAULT_BODY_FONT_FAMILY);
    });

    it('creates a :root rule when none exists and adds the token', () => {
      const input = `body {
  margin: 0;
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain(':root');
      expect(result.content).toContain(`--font-sans: ${DEFAULT_BODY_FONT_FAMILY}`);
    });

    it('inserts :root after @import lines so the import-first ordering is preserved', () => {
      const input = `@import url("https://fonts.googleapis.com/css2?family=Inter");

body {
  margin: 0;
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      const importIdx = result.content.indexOf('@import');
      const rootIdx = result.content.indexOf(':root');
      expect(importIdx).toBeGreaterThanOrEqual(0);
      expect(rootIdx).toBeGreaterThan(importIdx);
    });
  });

  describe('box-sizing reset', () => {
    it('adds the universal reset when no `*` rule declares box-sizing', () => {
      const input = `:root {
  --font-sans: system-ui;
}

body {
  font-family: var(--font-sans);
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain('box-sizing: border-box');
      expect(result.content).toMatch(/\*[^{]*\{[^}]*box-sizing/);
    });

    it("doesn't add the reset when the user already has * { box-sizing }", () => {
      const input = `:root {
  --font-sans: system-ui;
}

* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_SENTINEL}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(false);
      // No additional box-sizing rule was added.
      const matches = result.content.match(/box-sizing/g);
      expect(matches).toHaveLength(1);
    });

    it("doesn't add the reset when the user already has *, *::before, *::after { box-sizing }", () => {
      const input = `:root {
  --font-sans: system-ui;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_SENTINEL}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(false);
    });

    it("doesn't add the reset when the user has the html + inherit pattern", () => {
      const input = `:root {
  --font-sans: system-ui;
}

html {
  box-sizing: border-box;
}

*,
*::before,
*::after {
  box-sizing: inherit;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_SENTINEL}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(false);
    });

    it('still adds the reset when only per-class box-sizing exists (per-element overrides do not count)', () => {
      const input = `:root {
  --font-sans: system-ui;
}

.special {
  box-sizing: content-box;
}

body {
  font-family: var(--font-sans);
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      // The user's per-class override stays put.
      expect(result.content).toContain('.special');
      expect(result.content).toContain('content-box');
      // And the universal reset got appended.
      expect(result.content).toMatch(/\*[^{]*\{[^}]*box-sizing:\s*border-box/);
    });
  });

  describe('body font rule', () => {
    it('appends a body rule when no existing body { font-family } rule', () => {
      const input = `:root {
  --font-sans: system-ui;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain('body');
      expect(result.content).toContain('font-family: var(--font-sans)');
    });

    it("doesn't add a body font rule when one already exists with a different family", () => {
      const input = `:root {
  --color-primary: #3b82f6;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: 'Comic Sans MS', cursive;
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain(`--font-sans: ${DEFAULT_BODY_FONT_FAMILY}`);
      expect(result.content).toContain("font-family: 'Comic Sans MS', cursive");
      // Should NOT have appended a second body rule.
      const bodyMatches = result.content.match(/body\s*\{/g);
      expect(bodyMatches).toHaveLength(1);
    });
  });

  describe('browser reset block', () => {
    it('appends the reset block (with sentinel) when missing', () => {
      const input = `:root {
  --font-sans: 'Inter', sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain(BROWSER_RESET_SENTINEL);
      // Spot-check a few of the reset rules made it into the output.
      expect(result.content).toContain('p,');
      expect(result.content).toContain('margin: 0');
      expect(result.content).toContain('all: unset');
      expect(result.content).toContain('display: block');
    });

    it('is a no-op when the sentinel is already present (even without the rules)', () => {
      // The sentinel is the source of truth for "Scamp's reset is
      // installed". Users can edit / extend / delete the rules
      // themselves; we only check the comment.
      const input = `:root {
  --font-sans: 'Inter', sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_SENTINEL}
/* user has customised the rules, but the sentinel marks our presence */
p { margin: 8px 0; }
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(false);
      expect(result.content).toBe(input);
    });
  });

  describe('combined behaviour', () => {
    it('is a no-op when all four pieces are already present', () => {
      const input = `:root {
  --font-sans: 'Inter', sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_SENTINEL}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(false);
      expect(result.content).toBe(input);
    });

    it('adds all four to a bare :root file', () => {
      const input = `:root {
  --color-primary: #3b82f6;
}
`;
      const result = backfillThemeDefaults(input);
      expect(result.changed).toBe(true);
      expect(result.content).toContain(`--font-sans: ${DEFAULT_BODY_FONT_FAMILY}`);
      expect(result.content).toContain('box-sizing: border-box');
      expect(result.content).toContain('font-family: var(--font-sans)');
      expect(result.content).toContain(BROWSER_RESET_SENTINEL);
    });

    it('round-trips malformed CSS unchanged (parse-error tolerance)', () => {
      const input = `:root { --bad: ; this isn't valid;`;
      const result = backfillThemeDefaults(input);
      // Postcss is permissive — it may actually parse this. Either
      // way, the helper either no-ops (parser threw) or only adds
      // rules additively. Existing content must not be mangled.
      if (!result.changed) {
        expect(result.content).toBe(input);
      } else {
        expect(result.content).toContain('--bad');
      }
    });
  });
});
