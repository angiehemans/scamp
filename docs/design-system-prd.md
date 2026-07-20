# Scamp — Theme System Upgrade

## Overview

A comprehensive upgrade to Scamp's theme system. The current theme
panel is a popup with basic color token support. This upgrade moves
the theme editor into the main app frame as a dedicated panel, adds
full token coverage across color, typography, spacing, borders, corners,
and shadows, introduces semantic tokens, adds multi-theme support
(light, dark, and custom), and generates a `design.md` file that
documents the design system for agents and developers.

Everything saves to standard CSS custom properties in `theme.css` —
no proprietary format, no Tailwind dependency, no lock-in.

---

## Goals

1. Move theme editor out of a popup into the main app frame
2. Cover all token categories: color, typography, spacing, borders,
   corners, shadows
3. Add semantic tokens that reference primitive tokens
4. Add theme switcher for light, dark, and custom themes
5. Generate a `design.md` file documenting the design system
6. Provide forms for entering design system context that feeds into
   `design.md`

---

## File output

All theme work saves to two files in the project root:

**`theme.css`** — all token definitions as CSS custom properties,
structured by theme:

```css
/* Primitive tokens */
:root {
  /* Color primitives */
  --color-blue-50:  #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-500: #3b82f6;
  --color-blue-900: #1e3a8a;

  --color-neutral-0:   #ffffff;
  --color-neutral-50:  #f9fafb;
  --color-neutral-900: #111827;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Border width */
  --border-thin:   1px;
  --border-medium: 2px;
  --border-thick:  4px;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
}

/* Semantic tokens — light theme (default) */
:root {
  --color-background:       var(--color-neutral-0);
  --color-surface:          var(--color-neutral-50);
  --color-text-primary:     var(--color-neutral-900);
  --color-text-secondary:   var(--color-neutral-500);
  --color-brand:            var(--color-blue-500);
  --color-brand-hover:      var(--color-blue-600);
  --color-border:           var(--color-neutral-200);
}

/* Semantic tokens — dark theme */
.dark {
  --color-background:       var(--color-neutral-900);
  --color-surface:          var(--color-neutral-800);
  --color-text-primary:     var(--color-neutral-0);
  --color-text-secondary:   var(--color-neutral-400);
  --color-brand:            var(--color-blue-400);
  --color-brand-hover:      var(--color-blue-300);
  --color-border:           var(--color-neutral-700);
}

/* Typography tokens */
:root {
  --font-sans:  'Inter', sans-serif;
  --font-mono:  'JetBrains Mono', monospace;

  /* Semantic typography */
  --text-h1-size:    2.5rem;
  --text-h1-weight:  700;
  --text-h1-leading: 1.2;

  --text-h2-size:    2rem;
  --text-h2-weight:  700;
  --text-h2-leading: 1.25;

  --text-body-size:    1rem;
  --text-body-weight:  400;
  --text-body-leading: 1.5;

  --text-small-size:    0.875rem;
  --text-small-weight:  400;
  --text-small-leading: 1.5;

  --text-label-size:    0.75rem;
  --text-label-weight:  500;
  --text-label-leading: 1.4;
}
```

**`design.md`** — generated design system documentation for agents and
developers. See story 6 below.

---

## User stories

---

### 1. Move theme editor to main frame

**User story**

As a user managing my project's theme, I want the theme editor to
open as a dedicated panel in the main app frame rather than a popup
so I can work on my theme and see the canvas at the same time without
a modal blocking my view.

**Behaviour**

- The theme editor opens as a full-height right-side panel, replacing
  the properties panel — the same space the WYSIWYG controls occupy
- A "Theme" button in the left sidebar below the pages and components
  lists toggles the theme panel open and closed
- The theme panel has its own scroll — it is independent of the canvas
- The canvas remains interactive while the theme panel is open — users
  can select elements and see tokens applied in real time as they edit
- The theme panel remembers which section was last open between sessions

**Theme panel layout:**

```
┌─────────────────────────────────────────────┐
│  Theme                            [ + New ] │
│                                             │
│  [ Light ▾ ]  [ Dark ]  [ + Theme ]        │
│                                             │
│  ▼ Colors                                   │
│  ▼ Typography                               │
│  ▼ Spacing                                  │
│  ▼ Borders                                  │
│  ▼ Corners                                  │
│  ▼ Shadows                                  │
│  ▼ Design system                            │
└─────────────────────────────────────────────┘
```

---

### 2. Color tokens — primitives and semantic

**User story**

As a user building a design system, I want to define a palette of
primitive color tokens and then map them to semantic tokens so my
designs use meaningful names like `--color-brand` and `--color-background`
rather than raw hex values, and changing a primitive updates everything
that references it.

**Primitive colors**

The Colors section has two sub-sections: Primitives and Semantic.

**Primitives** — raw color values organised into named palettes:

- Default palettes auto-generated on project creation: Brand, Neutral,
  Error, Warning, Success — each with 9 shades (50 through 900)
- Users can add custom palettes with any name
- Each shade is a color picker + hex input
- A palette can be auto-generated from a single seed color — click
  "Generate palette" next to a palette name, pick a seed color, and
  Scamp generates a full 9-shade scale using OKLCH color space

Primitive token naming: `--color-[palette]-[shade]`
Example: `--color-brand-500: #3b82f6`

**Semantic tokens**

Semantic tokens reference primitive tokens and give meaning to them.
Semantic tokens are what components and elements should actually use —
they describe role, not value.

Default semantic tokens:

| Token | Default mapping |
|---|---|
| `--color-background` | `var(--color-neutral-0)` |
| `--color-surface` | `var(--color-neutral-50)` |
| `--color-text-primary` | `var(--color-neutral-900)` |
| `--color-text-secondary` | `var(--color-neutral-500)` |
| `--color-text-disabled` | `var(--color-neutral-300)` |
| `--color-brand` | `var(--color-brand-500)` |
| `--color-brand-hover` | `var(--color-brand-600)` |
| `--color-brand-subtle` | `var(--color-brand-50)` |
| `--color-border` | `var(--color-neutral-200)` |
| `--color-border-strong` | `var(--color-neutral-400)` |
| `--color-error` | `var(--color-error-500)` |
| `--color-warning` | `var(--color-warning-500)` |
| `--color-success` | `var(--color-success-500)` |

Each semantic token shows:
- Token name (editable)
- A dropdown to select the primitive it maps to, grouped by palette
- A color swatch showing the resolved value
- Users can add custom semantic tokens with any name and mapping

---

### 3. Theme switcher (light, dark, custom themes)

**User story**

As a user building a product that supports light and dark mode, I want
to define separate semantic token values for each theme so I can design
and preview both modes and have the correct CSS generated automatically.

**Behaviour**

- The theme panel header shows a tab row of all defined themes:
  ```
  [ Light ]  [ Dark ]  [ + Add theme ]
  ```
- Clicking a theme tab switches the panel to show that theme's semantic
  token values
- Clicking a theme tab also switches the canvas to preview that theme —
  the canvas applies the theme's CSS class to the root element
- Primitive tokens are global — they do not change between themes
- Semantic tokens have per-theme values — the Light tab shows light
  mode mappings, the Dark tab shows dark mode mappings
- Each semantic token row shows all theme values side by side in a
  compact view, or per-theme in focused view when a specific theme tab
  is active:

  ```
  --color-background
    Light:  var(--color-neutral-0)    ████ white
    Dark:   var(--color-neutral-900)  ████ near-black
  ```

- "+ Add theme" lets users create a named custom theme (e.g. "High
  contrast", "Brand A", "Brand B") which generates a new CSS class
  override block in `theme.css`

**Generated CSS for themes:**

```css
/* Light mode — default */
:root {
  --color-background: var(--color-neutral-0);
}

/* Dark mode */
.dark {
  --color-background: var(--color-neutral-900);
}

/* Custom theme */
.theme-high-contrast {
  --color-background: #000000;
  --color-text-primary: #ffffff;
}
```

**Canvas theme preview:**

A theme switcher also lives in the canvas toolbar (separate from the
theme panel) so users can quickly toggle between themes while working
on layouts without opening the theme panel.

---

### 4. Typography tokens

**User story**

As a user defining a type system, I want to set font families, a type
scale, and semantic text styles (h1, h2, body, label etc.) so my designs
use consistent typography and agents can reference meaningful token names
when writing components.

**Font families**

- A "Font families" sub-section at the top of Typography
- Add fonts by name (Google Fonts loaded automatically) or upload a
  font file (WOFF, WOFF2, TTF)
- Multiple font families supported — e.g. a sans-serif and a mono font
- Each font family generates a `--font-[name]` token:
  ```css
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  ```

**Type scale**

- A numeric type scale defining font size steps
- Users can choose from preset scales (Minor Third, Major Third,
  Perfect Fourth, Golden Ratio) or define custom sizes
- Each step generates a `--text-[step]-size` token

**Semantic text styles**

This is the most important part of typography tokens. Each semantic
text style defines a complete set of text properties — font family,
size, weight, line height, and optionally letter spacing — and generates
a group of related tokens:

Default semantic text styles:

| Style | Size | Weight | Line height |
|---|---|---|---|
| Display | 3.5rem | 800 | 1.1 |
| H1 | 2.5rem | 700 | 1.2 |
| H2 | 2rem | 700 | 1.25 |
| H3 | 1.5rem | 600 | 1.3 |
| H4 | 1.25rem | 600 | 1.35 |
| Body large | 1.125rem | 400 | 1.6 |
| Body | 1rem | 400 | 1.5 |
| Body small | 0.875rem | 400 | 1.5 |
| Label | 0.75rem | 500 | 1.4 |
| Code | 0.875rem | 400 | 1.6 |

Each text style generates a set of tokens:

```css
--text-h1-family:  var(--font-sans);
--text-h1-size:    2.5rem;
--text-h1-weight:  700;
--text-h1-leading: 1.2;
```

Text style tokens are available in the WYSIWYG typography section
via a "Text style" dropdown at the top — selecting H1 populates all
typography fields with the H1 token values.

Users can add, rename, edit, and delete text styles. Deleting a style
that is used on any element shows a warning listing affected elements.

---

### 5. Spacing, border, corner, and shadow tokens

**User story**

As a user building a design system, I want to define tokens for spacing,
border widths, border radii, and shadows so every dimension in my design
has a meaningful name and changing one value updates the whole system.

**Spacing**

- A numeric scale of spacing values — users define steps and their
  pixel values
- Preset scales available: 4px base, 8px base, or custom
- Each step generates `--space-[step]`
- Common defaults:
  ```css
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-5: 20px;  --space-6: 24px;
  --space-8: 32px;  --space-10: 40px; --space-12: 48px;
  --space-16: 64px;
  ```
- Spacing tokens appear as autocomplete suggestions in the WYSIWYG
  panel number inputs for padding, margin, and gap

**Border widths**

- A small set of named border width values
- Defaults: `--border-thin: 1px`, `--border-medium: 2px`,
  `--border-thick: 4px`
- Users can rename and add values

**Border radius (corners)**

- Named corner radius values
- Defaults:
  ```css
  --radius-none: 0;
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  24px;
  --radius-full: 9999px;
  ```
- A visual preview shows a rectangle with the corner radius applied
  for each token

**Shadows**

- Named shadow values — each is a full `box-shadow` value
- A shadow editor for each token — the same multi-layer shadow editor
  from the WYSIWYG panel (features-v4 story 1)
- Defaults:
  ```css
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04);
  ```
- Shadow tokens are available in the Shadows section of the WYSIWYG
  panel via a "Preset" dropdown that replaces all current shadow rows
  with the selected token value

---

### 6. Design system documentation (DESIGN.md)

**User story**

As a user building a product, I want Scamp to generate a spec-compliant
`DESIGN.md` file from my theme tokens and design system context so that
agents working on my project have rich, structured, machine-readable
understanding of the design system without me having to write it manually.

**The spec**

Scamp's generated `DESIGN.md` follows the Google Labs
[design.md specification](https://github.com/google-labs-code/design.md)
— a format that combines machine-readable YAML front matter (exact token
values) with human-readable markdown prose (rationale and usage guidance).

This is the right choice because:
- It is an open, versioned spec with a published CLI for linting and diffing
- Agents that understand the spec can read the YAML tokens programmatically
- The CLI (`npx @google/design.md lint DESIGN.md`) gives users instant
  feedback on broken token references and contrast ratio failures
- The export command can convert to Tailwind config or W3C DTCG format
  if the user needs it

**File location**

`DESIGN.md` lives in the project root alongside `agent.md`:

```
my-project/
├── agent.md       ← code conventions for agents
├── DESIGN.md      ← spec-compliant design system documentation
├── theme.css      ← CSS custom property definitions
└── app/
```

`agent.md` references it so agents always read both:

```markdown
## Design system
See `DESIGN.md` for brand guidelines, design principles, and token
usage documentation. This file follows the google-labs-code/design.md
specification — YAML front matter contains exact token values, markdown
prose contains rationale and usage guidance.
```

**File structure**

The generated file has two layers as required by the spec:

1. **YAML front matter** — machine-readable token definitions between
   `---` fences. Generated automatically from the theme panel tokens.
   Never edited directly — always kept in sync with `theme.css`.
2. **Markdown prose** — human-readable rationale filled in via the
   Design System forms in the theme panel. Follows the spec's required
   section order.

**YAML front matter — auto-generated from theme tokens**

The YAML is generated from the token data already defined in the theme
panel. Users never write YAML manually — the panel writes it.

Token mapping from Scamp theme to DESIGN.md spec:

| Scamp token category | DESIGN.md YAML key | Format |
|---|---|---|
| Semantic color tokens | `colors` | `token-name: hex or {ref}` |
| Typography text styles | `typography` | named objects with `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing` |
| Border radius | `rounded` | `scale-name: dimension` |
| Spacing | `spacing` | `scale-name: dimension` |
| Components (future) | `components` | named component token groups |

Token references use the spec's `{path.to.token}` syntax to express
semantic relationships:

```yaml
colors:
  brand: "{colors.primary}"
  background: "{colors.neutral-0}"
```

**Markdown prose — entered via Design System forms**

The Design System section at the bottom of the theme panel contains
forms that map to the spec's required section order:

| Form section | Spec section | Notes |
|---|---|---|
| Project basics | Overview | Name, description, platform, target audience |
| Brand voice and personality | Overview | Tone, personality tags, do's and don'ts |
| Color usage notes | Colors | Per-semantic-token usage guidance |
| Typography usage notes | Typography | Per-text-style usage guidance |
| Layout guidance | Layout | Spacing philosophy, max widths, grid usage |
| Elevation and shadow usage | Elevation & Depth | When to use each shadow level |
| Shape and corner usage | Shapes | Corner radius conventions |
| Component notes | Components | Usage guidance per component token |
| Do's and Don'ts | Do's and Don'ts | Global design rules |

Form fields are all optional — empty fields omit that content from
the prose section. The spec allows sections to be omitted.

**Full generated DESIGN.md example:**

```markdown
---
name: My Portfolio
description: Personal portfolio for Angie Hemans, UX designer and developer.
colors:
  primary: "#3b82f6"
  neutral-0: "#ffffff"
  neutral-900: "#111827"
  background: "{colors.neutral-0}"
  surface: "#f9fafb"
  text-primary: "{colors.neutral-900}"
  text-secondary: "#6b7280"
  brand: "{colors.primary}"
  border: "#e5e7eb"
  error: "#ef4444"
  success: "#22c55e"
  warning: "#f59e0b"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 10px 20px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
---

## Overview

Personal portfolio for Angie Hemans, UX designer and developer.
Target audience: potential clients, hiring managers, and collaborators.
Platform: marketing website.

Professional but approachable. Direct. Let the work speak. No jargon.

## Colors

The palette is rooted in high-contrast neutrals with a single blue accent.

- **brand ({colors.primary}):** Interactive elements only. Use sparingly.
- **text-primary ({colors.neutral-900}):** All headings and body copy.
- **text-secondary (#6b7280):** Supporting copy, captions, metadata.
- **background ({colors.neutral-0}):** Page background. Always use the
  token, never a raw hex.
- **surface (#f9fafb):** Cards and elevated surfaces.

## Typography

H1 is for page titles only — one per page. Never skip heading levels.
Body always uses 1rem with 1.5 line height. Labels are for UI metadata
and captions only.

## Layout

Base spacing unit is 8px. All spacing values are multiples of 8.
Maximum content width: 1200px centered. Page padding: 24px mobile,
48px desktop. Always reference spacing tokens, never raw pixel values.

## Elevation & Depth

Shadows are used sparingly. Use shadow-sm for cards and surfaces.
Never use more than one shadow level within the same component.

## Shapes

Rounded corners are consistent. Buttons use rounded-md. Tags and
chips use rounded-full. Never mix corner radii within one component.

## Components

Button primary uses brand color background with white text. Hover
darkens the background using the primary primitive directly.
Disabled state reduces opacity to 40%.

## Do's and Don'ts

**Do:** Use theme tokens for every color, size, and spacing value.
**Do:** Maintain consistent heading hierarchy across all pages.
**Don't:** Use raw hex values in component or element styles.
**Don't:** Introduce one-off spacing values outside the spacing scale.
```

**CLI integration**

The spec ships a CLI that Scamp can surface in the terminal:

```bash
# Lint for broken token references and contrast issues
npx @google/design.md lint DESIGN.md

# Diff two versions to detect regressions
npx @google/design.md diff DESIGN.md DESIGN-v2.md

# Export to Tailwind v4 CSS theme block
npx @google/design.md export --format css-tailwind DESIGN.md > tailwind-theme.css

# Export to W3C DTCG tokens.json
npx @google/design.md export --format dtcg DESIGN.md > tokens.json
```

A "Lint design system" button in the Design System section runs the
lint command and shows results inline in the theme panel without the
user needing to open the terminal.

**Sync behaviour**

- The YAML front matter is always generated from the current theme panel
  state — it is never manually editable in Scamp
- The markdown prose sections are always generated from the form fields
- The full file is regenerated on every theme token change and every
  form field edit, debounced at 500ms
- If the file is edited externally (by an agent), Scamp reads the
  markdown prose sections back into the form fields on next open.
  The YAML front matter from an external edit is ignored on read —
  theme token values are always authoritative from the theme panel
- chokidar watches `DESIGN.md` for external changes



### 7. Token usage in the WYSIWYG panel

**User story**

As a user setting styles on an element, I want to use theme tokens
from all categories in the WYSIWYG panel so my designs reference the
design system rather than hardcoded values.

**Behaviour**

Token pickers appear across all relevant WYSIWYG controls:

| Panel section | Token picker |
|---|---|
| Background color | Color semantic tokens + primitives |
| Border color | Color semantic tokens + primitives |
| Text color | Color semantic tokens + primitives |
| Shadow | Shadow tokens as presets |
| Border radius | Corner radius tokens |
| Border width | Border width tokens |
| Gap, padding, margin | Spacing tokens |
| Font size | Type scale tokens |
| Font weight | Surfaced as part of text style picker |
| Font family | Font family tokens |

Each token picker shows:
- Token name
- Resolved value
- A color swatch (for color tokens) or preview (for other types)

Selecting a token inserts `var(--token-name)` as the CSS value.
The WYSIWYG control shows the resolved value visually (e.g. the
swatch shows the actual color) while the CSS editor shows
`var(--color-brand)`.

A "Text style" dropdown at the top of the Typography section in the
WYSIWYG panel lets users apply a complete semantic text style in one
click — it sets font-family, size, weight, line-height, and
letter-spacing all at once to the values from the selected style token.

---

## Notes

- All token categories are optional — a user who only wants color
  tokens is not forced to fill in typography or spacing
- The design.md form fields are also optional — an empty field
  simply omits that section from the generated file
- Token names are validated — must start with `--`, no spaces, only
  letters, numbers, and hyphens
- Deleting a primitive token that is referenced by a semantic token
  shows a warning listing which semantic tokens will break
- Deleting a semantic token that is used in any element's CSS shows
  a warning listing affected elements — the CSS value becomes the
  raw resolved value (e.g. `var(--color-brand)` becomes `#3b82f6`)
  rather than being removed entirely
- The theme panel is read-only when the project is in a legacy file
  format (pre-Next.js structure) — a migration prompt is shown instead
- `theme.css` is watched by chokidar — external edits (by an agent
  updating token values) are reflected in the theme panel and across
  the canvas in real time