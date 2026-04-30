/**
 * Legacy `agent.md` — written into projects using the flat file layout
 * (`<page>.tsx` + `<page>.module.css` at the project root, assets in
 * `assets/`). Kept as the canonical instructions for legacy projects
 * that haven't yet been migrated to the Next.js App Router layout.
 *
 * Do NOT edit this without bumping the migration tooling — agents
 * working in legacy projects depend on it being accurate for that
 * layout.
 */
export const AGENT_MD_CONTENT_LEGACY = `# Scamp Project — Agent Instructions

You are editing files in a Scamp project. Scamp is a local design tool
that bidirectionally syncs canvas state with real \`.tsx\` + CSS module
files. Anything you write here is parsed and re-rendered on the canvas.

## TL;DR

- Edit CSS first, then TSX. Always. Same file write should look like:
  CSS save → wait → TSX save.
- Every Scamp element is a JSX node with both \`data-scamp-id="…"\` AND
  \`className={styles.…}\` matching the same string.
- One CSS class = one rule block. No combined selectors, no nested
  \`@media\`.
- If a class block already has rules in CSS, Scamp will leave it
  alone. Scamp only auto-creates EMPTY blocks for classes that
  appear in the TSX but aren't in the CSS yet.
- Anything Scamp doesn't model in its UI controls
  (\`box-shadow\`, \`transform\`, \`@keyframes\`, comments, etc.)
  round-trips through your file unchanged and renders on the canvas.

## What Scamp does and doesn't touch

| You write | Scamp's response |
|---|---|
| A new element in TSX with \`data-scamp-id="hero_x1y2"\` and a className that doesn't exist yet in the CSS | Scaffolds an empty \`.hero_x1y2 {}\` block in the CSS module. |
| A new element in TSX whose class IS already in the CSS module | Leaves your CSS rule alone. Renders the element with your styles. |
| Any CSS property — \`position: fixed\`, \`box-shadow\`, \`backdrop-filter\`, \`@keyframes\`, gradients, animations | Parsed if Scamp has a typed control for it; otherwise stored verbatim and emitted byte-equivalent. The canvas renders the real CSS either way. |
| \`var(--token)\` anywhere — including inside \`padding\`, \`margin\`, \`gap\` shorthands | Preserved verbatim. The canvas resolves the variable through the project's \`theme.css\` and renders the resulting value. |
| A \`@media (max-width: Npx)\` block whose \`Npx\` matches a project breakpoint | Parsed into the breakpoint cascade and editable from the panel at that breakpoint. |
| A \`@media\` block with \`min-width\`, non-pixel units, or a width that doesn't match a project breakpoint | Preserved verbatim at the bottom of the file but not interpreted by the canvas. |
| Comments and blank lines inside CSS class blocks | Preserved on round-trips so long as the class block isn't being rewritten by a canvas edit. |
| Loose text fragments and unclassed JSX (\`<br>\`, \`<strong>\`, raw text) inside a Scamp element | Preserved in source order in the TSX and rendered. NOT manipulable from the canvas — they appear as a "Raw" group in the layers panel. |

## Critical rules
- Never remove \`data-scamp-id\` attributes from any element.
- Never change the 4-char hex suffix of a class name (e.g. the \`a1b2\`
  in \`hero_card_a1b2\`) — it's the element's unique identifier.
- Never combine multiple selectors into one rule block
  (\`.a, .b { … }\` will be misread).
- Never nest \`@media\` inside a class rule — only the top-level form
  is parsed (see "Responsive breakpoints").
- One class = one rule block, always.
- \`data-scamp-id\` must always match the CSS class name exactly.

## File editing order — CSS first, then TSX

Scamp watches for file changes. When the TSX file is saved, Scamp
parses it and auto-scaffolds empty CSS class blocks for any new
\`data-scamp-id\` it finds whose class is NOT already in the CSS
module. If you write the TSX first, the auto-scaffold will land
*before* you write the matching styles.

**Always write or edit the CSS module file before the TSX file.**

1. Add / update styles in \`[page].module.css\`.
2. Then add / update markup in \`[page].tsx\`.

When the TSX lands, every class is already present in the CSS so
the scaffolder is a no-op and your styles are untouched.

If you are making changes to both files, re-read the CSS file
after writing the TSX in case Scamp added a scaffold for an
element whose class wasn't in the CSS yet.

## Worked example — a sticky navbar

You want a navbar fixed to the top of the page with a token-driven
padding and a circular brand badge.

Step 1: write the CSS (\`home.module.css\`):

\`\`\`css
.root {
}

.site_nav_n123 {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
}

.brand_b001 {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary);
}
\`\`\`

Step 2: write the TSX (\`home.tsx\`):

\`\`\`tsx
import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <nav data-scamp-id="site_nav_n123" className={styles.site_nav_n123}>
        <div data-scamp-id="brand_b001" className={styles.brand_b001} />
      </nav>
    </div>
  );
}
\`\`\`

What Scamp does on save:
- Parses both files.
- Sees \`.site_nav_n123\` and \`.brand_b001\` already in the CSS — leaves
  them alone.
- Renders the navbar with \`position: fixed\`, the token-driven padding,
  the \`backdrop-filter\`, and the circular brand badge — all preserved
  byte-equivalent.

If you later change the brand background colour from the canvas
panel, Scamp surgically rewrites just the \`background\` line inside
\`.brand_b001\`. Everything else in the file stays put.

## Project structure
Each page is two files: \`[page-name].tsx\` and \`[page-name].module.css\`.
Do not rename, move, or split these files.

Images live in the \`assets/\` folder. Reference them with relative paths:
- \`<img>\` elements: \`src="./assets/hero.png"\`
- Background images: \`background-image: url("./assets/hero.png")\`

Do not delete files from \`assets/\` unless the user asks.

## Component conventions
- Each page exports a single default React component.
- The root element uses \`styles.root\` and \`data-scamp-id="root"\`.
- Every other element needs both:
  - a \`data-scamp-id\` attribute matching the full CSS class name
  - a className following \`[prefix]_[4-char-hex-id]\`

### Element naming
The class name prefix identifies the element:

- **Default names:** \`rect_a1b2\` (container), \`text_c3d4\` (text)
- **Custom names:** \`hero_card_a1b2\`, \`sidebar_ff12\`, \`nav_links_e5f6\`

Custom names make the generated code more readable and help the user
identify elements in the layers panel. Use them when the element has
a clear semantic role. Rules:

- The prefix is lowercase, words separated by underscores.
- Only alphanumeric characters and underscores (no hyphens, no spaces).
- The last \`_XXXX\` segment is always the 4-char hex id — never change it.
- If the prefix is \`rect\` or \`text\`, scamp treats it as unnamed and
  infers the element type from the prefix. Any other prefix is a custom
  name, and scamp infers the type from the HTML tag instead.
- Custom names don't need to be unique — the hex suffix handles that.

When creating new elements, prefer descriptive names:

| Instead of        | Use                    |
|-------------------|------------------------|
| \`rect_a1b2\`       | \`hero_section_a1b2\`    |
| \`rect_c3d4\`       | \`sidebar_c3d4\`         |
| \`text_e5f6\`       | \`page_title_e5f6\`      |
| \`rect_g7h8\`       | \`nav_links_g7h8\`       |

- Do not add inline styles — all styles live in the CSS module.

## HTML tags
Use semantic HTML. Scamp captures the actual tag name and renders it
on the canvas, so the design preview matches what ships.

There are four element types, identified by the class-name prefix:

- **Text** (\`text_\` prefix or custom name) — any text-bearing tag:
  \`p\`, \`h1\`–\`h6\`, \`span\`, \`a\`, \`label\`, \`blockquote\`, \`pre\`,
  \`code\`, \`strong\`, \`em\`, \`small\`, \`time\`, \`figcaption\`, \`legend\`,
  \`li\`. Default: \`p\`.
- **Container** (\`rect_\` prefix or custom name) — block-level tags:
  \`div\`, \`section\`, \`article\`, \`aside\`, \`main\`, \`header\`,
  \`footer\`, \`nav\`, \`figure\`, \`form\`, \`fieldset\`, \`ul\`, \`ol\`,
  \`li\`, \`details\`, \`summary\`, \`dialog\`, \`button\`, \`a\`. Default:
  \`div\`.
- **Image / media** (\`img_\` prefix or custom name) — \`img\`, \`video\`,
  \`iframe\`, \`svg\`. Default: \`img\`.
- **Input / form control** (\`input_\` prefix or custom name) — \`input\`,
  \`textarea\`, \`select\`. Default: \`input\`.

Pick the tag that best describes the content. A page hero is a
\`<header>\`. A page title is an \`<h1>\`. A paragraph of body copy is
a \`<p>\`. The user will thank you (and so will their accessibility
audit).

### Tag-specific attributes

Scamp preserves every attribute you write on an element verbatim through
round-trips, so feel free to add the attributes a real HTML tag needs:

- \`<a>\` — \`href\`, \`target\`
- \`<button>\` — \`type\` (\`button\` / \`submit\` / \`reset\`)
- \`<form>\` — \`method\` (\`get\` / \`post\`), \`action\`
- \`<label>\` — \`htmlFor\` (React's spelling of HTML's \`for\`)
- \`<time>\` — \`datetime\`
- \`<blockquote>\` — \`cite\`
- \`<dialog>\` — \`open\` (bare, no value)
- \`<video>\` — \`src\`, \`controls\`, \`autoplay\`, \`loop\`, \`muted\`
  (bare for booleans)
- \`<iframe>\` — \`src\`, \`title\`
- \`<input>\` — \`type\` (text/email/password/number/checkbox/radio/
  range/date/file), \`placeholder\`
- \`<textarea>\` — \`rows\`, \`placeholder\`

### Two tags with dedicated syntax

- **\`<select>\`** children must be \`<option value="x">Label</option>\`
  elements only — don't nest other canvas elements inside. Scamp
  manages options through a typed list rather than as nested children.
- **\`<svg>\`** inner markup is preserved byte-for-byte but NOT rendered
  on the canvas (svg shows as a placeholder rectangle). Edit the raw
  source through the Element section in the properties panel, or in
  the TSX file directly — either way round-trips cleanly.

Example:

\`\`\`tsx
<div data-scamp-id="root" className={styles.root}>
  <header data-scamp-id="page_header_hdr0" className={styles.page_header_hdr0}>
    <h1 data-scamp-id="page_title_t1a2" className={styles.page_title_t1a2}>About</h1>
    <p data-scamp-id="bio_t3b4" className={styles.bio_t3b4}>I'm Angie...</p>
  </header>
  <nav data-scamp-id="nav_nav0" className={styles.rect_nav0}>
    <a data-scamp-id="link_l1n2" className={styles.text_l1n2} href="/about" target="_self">About</a>
  </nav>
  <form data-scamp-id="signup_f1a2" className={styles.rect_f1a2} method="post" action="/signup">
    <label data-scamp-id="email_lbl1" className={styles.text_lbl1} htmlFor="email">Email</label>
    <input data-scamp-id="email_in01" className={styles.input_in01} type="email" placeholder="you@example.com" />
  </form>
</div>
\`\`\`

### Loose text and unclassed JSX inside an element

You can interleave plain text and unclassed JSX (\`<br>\`, \`<strong>\`,
\`<em>\`, raw inline spans) with Scamp elements. They round-trip in
source order and render correctly. They appear in the layers panel
as a "Raw" group attached to the parent so the user can see them
exists, but they're not editable from the canvas — only by editing
the TSX file directly.

\`\`\`tsx
<div data-scamp-id="meta_m001" className={styles.meta_m001}>
  Role: <strong>Founder, Designer, Developer</strong>
</div>
\`\`\`

If you want any of those text fragments to be canvas-editable, wrap
each one in its own classed element with a \`data-scamp-id\` and a
matching CSS class.

## CSS conventions
- One property per line.
- Shorthand is fine (\`border: 1px solid #ccc\`, \`padding: 16px 24px\`).
- The page root is a regular rectangle in Scamp — it defaults to
  \`width: 100%\`, \`height: auto\`, and \`position: relative\` so the
  exported component works anywhere. Scamp does NOT write the canvas
  viewport size (1440, 768, etc.) into \`.root\` — that's a design-tool
  preference stored separately in \`scamp.config.json\`. Don't
  re-introduce fixed pixel dimensions on \`.root\` unless the user
  specifically wants a fixed-width page.
- Width / height values:
  - \`width: 100%\` and \`height: 100%\` mean stretch to fill the parent.
  - \`width: fit-content\` and \`height: fit-content\` mean shrink to content.
  - \`width: auto\` / \`height: auto\` (or simply omitting the
    declaration) leaves the dimension up to normal CSS layout.
  - Pixel values (\`width: 320px\`) are explicit fixed sizes.
- For free-form (non-flex) container layouts, scamp positions children
  with \`position: absolute; left: Xpx; top: Ypx;\`. You can override
  with any other \`position\` value (\`fixed\`, \`sticky\`, \`relative\`,
  \`static\`) — Scamp respects what you wrote.
- Inside a flex parent, the flex layout engine takes over and
  positional declarations on the child are ignored. Same applies to
  grid children inside a grid container.

## CSS properties
Use any CSS property you'd use in a real stylesheet. Scamp renders
**every** valid CSS property on the canvas — there's no allow-list.

Internally Scamp routes a small set of properties (\`background\`,
\`border\`, \`border-radius\`, \`color\`, \`display\`, \`flex-direction\`,
\`align-items\`, \`justify-content\`, \`gap\`, \`width\`, \`height\`,
\`padding\`, \`margin\`, \`opacity\`, \`position\`, \`font-size\`,
\`font-weight\`, \`text-align\`, \`line-height\`, \`letter-spacing\`,
\`font-family\`, \`transition\`, plus the grid container/item set)
into typed fields it can later expose via UI controls. Everything
else (\`box-shadow\`, \`transform\`, \`backdrop-filter\`, \`filter\`,
\`clip-path\`, animations, gradients, \`@keyframes\`, …) round-trips
through the file untouched AND is applied to the rendered element
on the canvas.

\`var(--token)\` works anywhere a CSS value works, including inside
shorthand declarations like \`padding: var(--space-3) var(--space-5)\`.
Scamp resolves the variable at render time through \`theme.css\`.

Pseudo-selectors (\`:hover\`, \`:focus\`, \`:active\`, \`:nth-child\`) and
at-rules other than \`@media (max-width: Npx)\` are preserved verbatim
but not parsed into the canvas model.

## Responsive breakpoints

Scamp writes per-breakpoint overrides as top-level \`@media
(max-width: Npx)\` blocks AT THE BOTTOM of the CSS module, AFTER every
base class rule. Each breakpoint has its own block containing one
class rule per element that overrides a property at that width:

\`\`\`css
.rect_a1b2 {
  width: 100%;
  padding: 24px;
}

.rect_c3d4 {
  background: #eee;
}

@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
}

@media (max-width: 390px) {
  .rect_a1b2 {
    padding: 8px;
  }
  .rect_c3d4 {
    width: 100%;
  }
}
\`\`\`

Rules for agents:

- **Only \`max-width\` queries are parsed.** \`min-width\`,
  \`prefers-color-scheme\`, \`orientation\`, and other query shapes are
  preserved verbatim but Scamp's canvas won't react to them.
- **Only pixel values are parsed.** \`max-width: 48rem\` won't be
  matched to a project breakpoint; use \`max-width: 768px\` etc.
- **The \`Npx\` value must match a breakpoint defined in the
  project.** Default breakpoints are 768 (tablet) and 390 (mobile).
  Unknown widths are preserved verbatim but treated as opaque.
- **Emit breakpoints widest-first** (tablet before mobile) so the CSS
  cascade picks the narrowest matching override.
- **Never nest \`@media\` inside a class rule** — only the top-level
  form above is parsed.
- **Desktop is the base.** Put desktop styles directly on the class,
  not inside a \`@media\` block.

## Per-element states (\`:hover\`, \`:active\`, \`:focus\`)

Scamp models three CSS pseudo-classes as first-class element states.
Style overrides for a state are written as a separate rule block
sharing the element's class name:

\`\`\`css
.rect_a1b2 {
  background: #ffffff;
  border-radius: 8px;
}

.rect_a1b2:hover {
  background: #f0f0f0;
}

.rect_a1b2:active {
  background: #e0e0e0;
}
\`\`\`

Rules for agents:

- **Emit state blocks immediately after the element's base block**,
  before any \`@media\` queries. Order: \`:hover\` → \`:active\` →
  \`:focus\`.
- **Only declare properties that differ from the base.** Scamp picks
  up the change as a state-specific override; redeclaring identical
  values just makes the file noisier.
- **Empty state blocks aren't allowed** — if an override has no
  declarations, omit the block entirely.
- **A transition declared on the base applies to all state changes
  automatically** (correct CSS behaviour). Don't add per-state
  \`transition\` declarations — Scamp doesn't model them.

### Other pseudo-classes are preserved verbatim

\`:focus-visible\`, \`:disabled\`, \`:checked\`, \`:nth-child(...)\`,
compound selectors like \`.rect_a1b2:hover .child\` — anything that
isn't one of the three recognised states — round-trip through Scamp
unchanged but aren't editable from the panel. Agents can write them
freely; Scamp preserves them text-stable.

## CSS Variables and Tokens

The project includes a \`theme.css\` file with two sections:

1. **Font imports** — optional \`@import url(...)\` lines at the top
   referencing Google Fonts. Scamp's Fonts panel manages these.
2. **Design tokens** — CSS custom properties inside \`:root\`.

\`\`\`css
/* scamp: font imports — managed by Project Settings → Fonts */
@import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");

:root {
  --color-primary: #3b82f6;
  --color-text: #111111;
}
\`\`\`

Reference tokens in module CSS files using \`var()\` — anywhere a CSS
value goes, including inside shorthands:

\`\`\`css
.button {
  background-color: var(--color-primary);
  color: var(--color-text);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
}
\`\`\`

Do not modify \`theme.css\` unless the user asks for design system updates.

## Project config

Each project also has a \`scamp.config.json\` file at the root. It holds
per-project settings like the artboard background colour. Scamp
reads and writes this file; don't modify it unless the user asks.

## What NOT to change
- Do not alter the import line at the top of the TSX file.
- Do not rename the default export function.
- Do not add new \`.tsx\` / \`.module.css\` files unless the user asks
  for a new page.
- Do not strip \`position: relative\` from \`.root\` — absolute-
  positioned children rely on it to anchor to the page root.
- Do not delete \`theme.css\` — it holds the project's design tokens
  and font imports.
- Do not delete \`scamp.config.json\` — it holds per-project settings.
- Do not combine multiple selectors into one rule block.
- Do not nest \`@media\` inside a class rule.
`;

/**
 * Default theme.css content for a freshly created project.
 * Provides a small starter palette of color tokens.
 */
export const DEFAULT_THEME_CSS = `:root {
  --color-primary: #3b82f6;
  --color-secondary: #6366f1;
  --color-background: #ffffff;
  --color-surface: #f5f5f5;
  --color-text: #111111;
  --color-muted: #888888;
}
`;

/**
 * Default page TSX content for a freshly created page. The
 * `cssModuleImportName` defaults to `moduleName`, which gives the
 * legacy flat-layout import (`./<page>.module.css`); pass `'page'` for
 * the Next.js App Router layout where every page imports its co-
 * located `./page.module.css` regardless of slug.
 */
export const defaultPageTsx = (
  componentName: string,
  moduleName: string,
  cssModuleImportName: string = moduleName
): string => {
  return `import styles from './${cssModuleImportName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root}>
    </div>
  );
}
`;
};

/**
 * Auto-generated `app/layout.tsx` for a Next.js-format project. Imports
 * the project's `theme.css` so the design tokens it defines apply when
 * the user runs `next dev` outside Scamp. The user is documented (in
 * `agent.md`) to leave this file alone.
 */
export const defaultLayoutTsx = (projectName: string): string => {
  return `import type { Metadata } from 'next';
import './theme.css';

export const metadata: Metadata = {
  title: '${projectName}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
};

/**
 * Auto-generated `next.config.ts` for a Next.js-format project. Empty
 * config — we don't enable image optimisation, custom webpack, or
 * anything else by default. Users can extend it freely.
 */
export const DEFAULT_NEXT_CONFIG_TS = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
`;

/**
 * Auto-generated `package.json` for a Next.js-format project. Pinned
 * minor versions for the Next.js / React stack so a Scamp-created
 * project doesn't quietly drift onto a major-version bump that breaks
 * the App Router conventions Scamp relies on.
 */
export const defaultPackageJson = (projectName: string): string => {
  const data = {
    name: projectName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: {
      '@types/node': '^22.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.5.0',
    },
  };
  return `${JSON.stringify(data, null, 2)}\n`;
};

/**
 * Default page CSS module content.
 *
 * Empty-by-default: the root element's shape is supplied by Scamp's
 * defaults (`width: 100%; height: auto; position: relative`). Only
 * user overrides land in this file, keeping the exported CSS free of
 * canvas-tool artefacts.
 */
export const DEFAULT_PAGE_CSS = `.root {
}
`;

/**
 * `agent.md` written into projects using the Next.js App Router layout
 * (the default for new projects). Differs from the legacy template in
 * project structure, asset path conventions, and the list of files
 * agents should leave alone.
 */
export const AGENT_MD_CONTENT = `# Scamp Project — Agent Instructions

You are editing files in a Scamp project. Scamp is a local design tool
that bidirectionally syncs canvas state with real \`.tsx\` + CSS module
files. Anything you write here is parsed and re-rendered on the canvas.

This project uses the **Next.js App Router** layout — it can be opened
directly in a Next.js workspace and run with \`next dev\` outside of
Scamp without any reorganisation.

## TL;DR

- Edit CSS first, then TSX. Always. Same file write should look like:
  CSS save → wait → TSX save.
- Every Scamp element is a JSX node with both \`data-scamp-id="…"\` AND
  \`className={styles.…}\` matching the same string.
- One CSS class = one rule block. No combined selectors, no nested
  \`@media\`.
- If a class block already has rules in CSS, Scamp will leave it
  alone. Scamp only auto-creates EMPTY blocks for classes that
  appear in the TSX but aren't in the CSS yet.
- Anything Scamp doesn't model in its UI controls
  (\`box-shadow\`, \`transform\`, \`@keyframes\`, comments, etc.)
  round-trips through your file unchanged and renders on the canvas.

## What Scamp does and doesn't touch

| You write | Scamp's response |
|---|---|
| A new element in TSX with \`data-scamp-id="hero_x1y2"\` and a className that doesn't exist yet in the CSS | Scaffolds an empty \`.hero_x1y2 {}\` block in the CSS module. |
| A new element in TSX whose class IS already in the CSS module | Leaves your CSS rule alone. Renders the element with your styles. |
| Any CSS property — \`position: fixed\`, \`box-shadow\`, \`backdrop-filter\`, \`@keyframes\`, gradients, animations | Parsed if Scamp has a typed control for it; otherwise stored verbatim and emitted byte-equivalent. The canvas renders the real CSS either way. |
| \`var(--token)\` anywhere — including inside \`padding\`, \`margin\`, \`gap\` shorthands | Preserved verbatim. The canvas resolves the variable through the project's \`theme.css\` and renders the resulting value. |
| A \`@media (max-width: Npx)\` block whose \`Npx\` matches a project breakpoint | Parsed into the breakpoint cascade and editable from the panel at that breakpoint. |
| A \`@media\` block with \`min-width\`, non-pixel units, or a width that doesn't match a project breakpoint | Preserved verbatim at the bottom of the file but not interpreted by the canvas. |
| Comments and blank lines inside CSS class blocks | Preserved on round-trips so long as the class block isn't being rewritten by a canvas edit. |
| Loose text fragments and unclassed JSX (\`<br>\`, \`<strong>\`, raw text) inside a Scamp element | Preserved in source order in the TSX and rendered. NOT manipulable from the canvas — they appear as a "Raw" group in the layers panel. |

## Critical rules
- Never remove \`data-scamp-id\` attributes from any element.
- Never change the 4-char hex suffix of a class name (e.g. the \`a1b2\`
  in \`hero_card_a1b2\`) — it's the element's unique identifier.
- Never combine multiple selectors into one rule block
  (\`.a, .b { … }\` will be misread).
- Never nest \`@media\` inside a class rule — only the top-level form
  is parsed (see "Responsive breakpoints").
- One class = one rule block, always.
- \`data-scamp-id\` must always match the CSS class name exactly.

## File editing order — CSS first, then TSX

Scamp watches for file changes. When the TSX file is saved, Scamp
parses it and auto-scaffolds empty CSS class blocks for any new
\`data-scamp-id\` it finds whose class is NOT already in the CSS
module. If you write the TSX first, the auto-scaffold will land
*before* you write the matching styles.

**Always write or edit the CSS module file before the TSX file.**

1. Add / update styles in \`app/[page]/page.module.css\`.
2. Then add / update markup in \`app/[page]/page.tsx\`.

When the TSX lands, every class is already present in the CSS so
the scaffolder is a no-op and your styles are untouched.

If you are making changes to both files, re-read the CSS file
after writing the TSX in case Scamp added a scaffold for an
element whose class wasn't in the CSS yet.

## Worked example — a sticky navbar

You want a navbar fixed to the top of the page with a token-driven
padding and a circular brand badge.

Step 1: write the CSS (\`app/page.module.css\`):

\`\`\`css
.root {
}

.site_nav_n123 {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
}

.brand_b001 {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary);
}
\`\`\`

Step 2: write the TSX (\`app/page.tsx\`):

\`\`\`tsx
import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <nav data-scamp-id="site_nav_n123" className={styles.site_nav_n123}>
        <div data-scamp-id="brand_b001" className={styles.brand_b001} />
      </nav>
    </div>
  );
}
\`\`\`

What Scamp does on save:
- Parses both files.
- Sees \`.site_nav_n123\` and \`.brand_b001\` already in the CSS — leaves
  them alone.
- Renders the navbar with \`position: fixed\`, the token-driven padding,
  the \`backdrop-filter\`, and the circular brand badge — all preserved
  byte-equivalent.

If you later change the brand background colour from the canvas
panel, Scamp surgically rewrites just the \`background\` line inside
\`.brand_b001\`. Everything else in the file stays put.

## Project structure

This is a Next.js App Router project:

- **Root / Home page**: \`app/page.tsx\` and \`app/page.module.css\`.
- **Additional pages**: \`app/[page-name]/page.tsx\` and
  \`app/[page-name]/page.module.css\` (one folder per page).
- **Shared root layout**: \`app/layout.tsx\` — do not modify.
- **Design tokens**: \`app/theme.css\` — imported from \`app/layout.tsx\`,
  defines the project's CSS custom properties.
- **Next.js config**: \`next.config.ts\` — do not modify.
- **Package manifest**: \`package.json\` — do not modify (Scamp pins
  the Next.js / React versions it expects).
- **Per-project Scamp settings**: \`scamp.config.json\` — do not modify.
- **Static assets**: \`public/assets/\`. Next.js serves the \`public/\`
  directory at the URL root, so \`public/assets/hero.png\` is
  accessible at \`/assets/hero.png\`.

Do not move, rename, or restructure these files.
Each page exports a single default React component.
All styles live in the co-located CSS Modules file.

## Component conventions
- Each page exports a single default React component.
- The root element uses \`styles.root\` and \`data-scamp-id="root"\`.
- Every other element needs both:
  - a \`data-scamp-id\` attribute matching the full CSS class name
  - a className following \`[prefix]_[4-char-hex-id]\`

### Element naming
The class name prefix identifies the element:

- **Default names:** \`rect_a1b2\` (container), \`text_c3d4\` (text)
- **Custom names:** \`hero_card_a1b2\`, \`sidebar_ff12\`, \`nav_links_e5f6\`

Custom names make the generated code more readable and help the user
identify elements in the layers panel. Use them when the element has
a clear semantic role. Rules:

- The prefix is lowercase, words separated by underscores.
- Only alphanumeric characters and underscores (no hyphens, no spaces).
- The last \`_XXXX\` segment is always the 4-char hex id — never change it.
- If the prefix is \`rect\` or \`text\`, scamp treats it as unnamed and
  infers the element type from the prefix. Any other prefix is a custom
  name, and scamp infers the type from the HTML tag instead.
- Custom names don't need to be unique — the hex suffix handles that.

When creating new elements, prefer descriptive names:

| Instead of        | Use                    |
|-------------------|------------------------|
| \`rect_a1b2\`       | \`hero_section_a1b2\`    |
| \`rect_c3d4\`       | \`sidebar_c3d4\`         |
| \`text_e5f6\`       | \`page_title_e5f6\`      |
| \`rect_g7h8\`       | \`nav_links_g7h8\`       |

- Do not add inline styles — all styles live in the CSS module.

## HTML tags
Use semantic HTML. Scamp captures the actual tag name and renders it
on the canvas, so the design preview matches what ships.

There are four element types, identified by the class-name prefix:

- **Text** (\`text_\` prefix or custom name) — any text-bearing tag:
  \`p\`, \`h1\`–\`h6\`, \`span\`, \`a\`, \`label\`, \`blockquote\`, \`pre\`,
  \`code\`, \`strong\`, \`em\`, \`small\`, \`time\`, \`figcaption\`, \`legend\`,
  \`li\`. Default: \`p\`.
- **Container** (\`rect_\` prefix or custom name) — block-level tags:
  \`div\`, \`section\`, \`article\`, \`aside\`, \`main\`, \`header\`,
  \`footer\`, \`nav\`, \`figure\`, \`form\`, \`fieldset\`, \`ul\`, \`ol\`,
  \`li\`, \`details\`, \`summary\`, \`dialog\`, \`button\`, \`a\`. Default:
  \`div\`.
- **Image / media** (\`img_\` prefix or custom name) — \`img\`, \`video\`,
  \`iframe\`, \`svg\`. Default: \`img\`.
- **Input / form control** (\`input_\` prefix or custom name) — \`input\`,
  \`textarea\`, \`select\`. Default: \`input\`.

Pick the tag that best describes the content. A page hero is a
\`<header>\`. A page title is an \`<h1>\`. A paragraph of body copy is
a \`<p>\`. The user will thank you (and so will their accessibility
audit).

### Tag-specific attributes

Scamp preserves every attribute you write on an element verbatim through
round-trips, so feel free to add the attributes a real HTML tag needs:

- \`<a>\` — \`href\`, \`target\`
- \`<button>\` — \`type\` (\`button\` / \`submit\` / \`reset\`)
- \`<form>\` — \`method\` (\`get\` / \`post\`), \`action\`
- \`<label>\` — \`htmlFor\` (React's spelling of HTML's \`for\`)
- \`<time>\` — \`datetime\`
- \`<blockquote>\` — \`cite\`
- \`<dialog>\` — \`open\` (bare, no value)
- \`<video>\` — \`src\`, \`controls\`, \`autoplay\`, \`loop\`, \`muted\`
  (bare for booleans)
- \`<iframe>\` — \`src\`, \`title\`
- \`<input>\` — \`type\` (text/email/password/number/checkbox/radio/
  range/date/file), \`placeholder\`
- \`<textarea>\` — \`rows\`, \`placeholder\`

### Two tags with dedicated syntax

- **\`<select>\`** children must be \`<option value="x">Label</option>\`
  elements only — don't nest other canvas elements inside. Scamp
  manages options through a typed list rather than as nested children.
- **\`<svg>\`** inner markup is preserved byte-for-byte but NOT rendered
  on the canvas (svg shows as a placeholder rectangle). Edit the raw
  source through the Element section in the properties panel, or in
  the TSX file directly — either way round-trips cleanly.

## Images and static assets

Static assets (images, SVGs, fonts) live in \`public/assets/\`. Next.js
serves the \`public/\` directory at the URL root, so a file at
\`public/assets/hero.png\` is accessible at \`/assets/hero.png\`.

CSS background image references use the absolute root path:

\`\`\`css
background-image: url('/assets/hero.png');
\`\`\`

TSX \`<img>\` elements reference the same path:

\`\`\`tsx
<img src="/assets/hero.png" alt="" />
\`\`\`

Always place new images in \`public/assets/\` and reference them with
the leading-slash form. Do not delete files from \`public/assets/\`
unless the user asks.

## CSS conventions
- One property per line.
- Shorthand is fine (\`border: 1px solid #ccc\`, \`padding: 16px 24px\`).
- The page root is a regular rectangle in Scamp — it defaults to
  \`width: 100%\`, \`height: auto\`, and \`position: relative\` so the
  exported component works anywhere. Scamp does NOT write the canvas
  viewport size (1440, 768, etc.) into \`.root\` — that's a design-tool
  preference stored separately in \`scamp.config.json\`. Don't
  re-introduce fixed pixel dimensions on \`.root\` unless the user
  specifically wants a fixed-width page.
- Width / height values:
  - \`width: 100%\` and \`height: 100%\` mean stretch to fill the parent.
  - \`width: fit-content\` and \`height: fit-content\` mean shrink to content.
  - \`width: auto\` / \`height: auto\` (or simply omitting the
    declaration) leaves the dimension up to normal CSS layout.
  - Pixel values (\`width: 320px\`) are explicit fixed sizes.
- For free-form (non-flex) container layouts, scamp positions children
  with \`position: absolute; left: Xpx; top: Ypx;\`. You can override
  with any other \`position\` value (\`fixed\`, \`sticky\`, \`relative\`,
  \`static\`) — Scamp respects what you wrote.
- Inside a flex parent, the flex layout engine takes over and
  positional declarations on the child are ignored. Same applies to
  grid children inside a grid container.

## CSS properties
Use any CSS property you'd use in a real stylesheet. Scamp renders
**every** valid CSS property on the canvas — there's no allow-list.

Internally Scamp routes a small set of properties (\`background\`,
\`border\`, \`border-radius\`, \`color\`, \`display\`, \`flex-direction\`,
\`align-items\`, \`justify-content\`, \`gap\`, \`width\`, \`height\`,
\`padding\`, \`margin\`, \`opacity\`, \`position\`, \`font-size\`,
\`font-weight\`, \`text-align\`, \`line-height\`, \`letter-spacing\`,
\`font-family\`, \`transition\`, plus the grid container/item set)
into typed fields it can later expose via UI controls. Everything
else (\`box-shadow\`, \`transform\`, \`backdrop-filter\`, \`filter\`,
\`clip-path\`, animations, gradients, \`@keyframes\`, …) round-trips
through the file untouched AND is applied to the rendered element
on the canvas.

\`var(--token)\` works anywhere a CSS value works, including inside
shorthand declarations like \`padding: var(--space-3) var(--space-5)\`.
Scamp resolves the variable at render time through \`app/theme.css\`.

Pseudo-selectors (\`:hover\`, \`:focus\`, \`:active\`, \`:nth-child\`) and
at-rules other than \`@media (max-width: Npx)\` are preserved verbatim
but not parsed into the canvas model.

## Responsive breakpoints

Scamp writes per-breakpoint overrides as top-level \`@media
(max-width: Npx)\` blocks AT THE BOTTOM of the CSS module, AFTER every
base class rule. Each breakpoint has its own block containing one
class rule per element that overrides a property at that width:

\`\`\`css
.rect_a1b2 {
  width: 100%;
  padding: 24px;
}

.rect_c3d4 {
  background: #eee;
}

@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
}

@media (max-width: 390px) {
  .rect_a1b2 {
    padding: 8px;
  }
  .rect_c3d4 {
    width: 100%;
  }
}
\`\`\`

Rules for agents:

- **Only \`max-width\` queries are parsed.** \`min-width\`,
  \`prefers-color-scheme\`, \`orientation\`, and other query shapes are
  preserved verbatim but Scamp's canvas won't react to them.
- **Only pixel values are parsed.** \`max-width: 48rem\` won't be
  matched to a project breakpoint; use \`max-width: 768px\` etc.
- **The \`Npx\` value must match a breakpoint defined in the
  project.** Default breakpoints are 768 (tablet) and 390 (mobile).
  Unknown widths are preserved verbatim but treated as opaque.
- **Emit breakpoints widest-first** (tablet before mobile) so the CSS
  cascade picks the narrowest matching override.
- **Never nest \`@media\` inside a class rule** — only the top-level
  form above is parsed.
- **Desktop is the base.** Put desktop styles directly on the class,
  not inside a \`@media\` block.

## Per-element states (\`:hover\`, \`:active\`, \`:focus\`)

Scamp models three CSS pseudo-classes as first-class element states.
Style overrides for a state are written as a separate rule block
sharing the element's class name:

\`\`\`css
.rect_a1b2 {
  background: #ffffff;
  border-radius: 8px;
}

.rect_a1b2:hover {
  background: #f0f0f0;
}

.rect_a1b2:active {
  background: #e0e0e0;
}
\`\`\`

Rules for agents:

- **Emit state blocks immediately after the element's base block**,
  before any \`@media\` queries. Order: \`:hover\` → \`:active\` →
  \`:focus\`.
- **Only declare properties that differ from the base.** Scamp picks
  up the change as a state-specific override; redeclaring identical
  values just makes the file noisier.
- **Empty state blocks aren't allowed** — if an override has no
  declarations, omit the block entirely.
- **A transition declared on the base applies to all state changes
  automatically** (correct CSS behaviour). Don't add per-state
  \`transition\` declarations — Scamp doesn't model them.

### Other pseudo-classes are preserved verbatim

\`:focus-visible\`, \`:disabled\`, \`:checked\`, \`:nth-child(...)\`,
compound selectors like \`.rect_a1b2:hover .child\` — anything that
isn't one of the three recognised states — round-trip through Scamp
unchanged but aren't editable from the panel. Agents can write them
freely; Scamp preserves them text-stable.

## CSS Variables and Tokens

The project includes an \`app/theme.css\` file with two sections:

1. **Font imports** — optional \`@import url(...)\` lines at the top
   referencing Google Fonts. Scamp's Fonts panel manages these.
2. **Design tokens** — CSS custom properties inside \`:root\`.

\`\`\`css
/* scamp: font imports — managed by Project Settings → Fonts */
@import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");

:root {
  --color-primary: #3b82f6;
  --color-text: #111111;
}
\`\`\`

\`app/theme.css\` is imported from \`app/layout.tsx\` so the tokens
apply to every page when running \`next dev\`. Reference tokens in
module CSS files using \`var()\` — anywhere a CSS value goes,
including inside shorthands:

\`\`\`css
.button {
  background-color: var(--color-primary);
  color: var(--color-text);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
}
\`\`\`

Do not modify \`app/theme.css\` unless the user asks for design-system
updates.

## Project config

\`scamp.config.json\` at the project root holds per-project settings
like the artboard background colour and breakpoint table. Scamp
reads and writes this file; don't modify it unless the user asks.

## What NOT to change
- Do not alter the import line at the top of any \`page.tsx\` file.
- Do not rename the default export function in any \`page.tsx\`.
- Do not modify \`app/layout.tsx\` — the root layout is part of the
  Next.js scaffold.
- Do not modify \`next.config.ts\` or \`package.json\` — these are
  Scamp-managed scaffold files.
- Do not add new \`page.tsx\` / \`page.module.css\` files unless the
  user asks for a new page (Scamp creates the folder for you).
- Do not strip \`position: relative\` from \`.root\` — absolute-
  positioned children rely on it to anchor to the page root.
- Do not delete \`app/theme.css\` — it holds the project's design
  tokens and font imports and is imported from the root layout.
- Do not delete \`scamp.config.json\` — it holds per-project settings.
- Do not combine multiple selectors into one rule block.
- Do not nest \`@media\` inside a class rule.
`;
