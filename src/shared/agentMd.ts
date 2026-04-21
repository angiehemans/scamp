/**
 * The contents of the agent.md file written into every new project.
 * Documented in prd-scamp-poc.md §8.
 */
export const AGENT_MD_CONTENT = `# Scamp Project — Agent Instructions

You are editing files in a Scamp project. Scamp is a local design tool
that bidirectionally syncs canvas state with real \`.tsx\` + CSS module
files. Anything you write here is parsed and re-rendered on the canvas.

## Critical rules
- Never remove \`data-scamp-id\` attributes from any element
- Never change the 4-char hex suffix of a class name (e.g. the \`a1b2\`
  in \`hero_card_a1b2\`) — it's the element's unique identifier
- Never combine multiple selectors into one rule block
- Never add media queries to generated class blocks
- One class = one rule block, always
- \`data-scamp-id\` must always match the CSS class name exactly

## File editing order — CSS first, then TSX

Scamp watches for file changes. When the TSX file is saved, Scamp
immediately parses it and auto-scaffolds empty CSS class blocks for
any new elements it finds. If you write the TSX first and then try
to edit the CSS, the file will have changed underneath you and your
edit will fail.

**Always write or edit the CSS module file before the TSX file.**

1. Add / update styles in \`[page].module.css\`
2. Then add / update markup in \`[page].tsx\`

This way, when Scamp parses the new TSX, the CSS already contains
your styles and no scaffolding overwrites them.

If you are making changes to both files, re-read the CSS file after
writing the TSX to pick up any changes Scamp may have made.

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

- The prefix is lowercase, words separated by underscores
- Only alphanumeric characters and underscores (no hyphens, no spaces)
- The last \`_XXXX\` segment is always the 4-char hex id — never change it
- If the prefix is \`rect\` or \`text\`, scamp treats it as unnamed and
  infers the element type from the prefix. Any other prefix is a custom
  name, and scamp infers the type from the HTML tag instead.
- Custom names don't need to be unique — the hex suffix handles that

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
  with \`position: absolute; left: Xpx; top: Ypx;\`. You can write these
  manually, but inside a flex parent the layout engine takes over and
  positional declarations are ignored.

## CSS properties
Use any CSS property you'd use in a real stylesheet. Scamp renders
**every** valid CSS property on the canvas — there's no allow-list.

Internally scamp routes a small set of properties (\`background\`,
\`border\`, \`border-radius\`, \`color\`, \`display\`, \`flex-direction\`,
\`align-items\`, \`justify-content\`, \`gap\`, \`width\`, \`height\`,
\`padding\`, \`font-size\`, \`font-weight\`, \`text-align\`) into typed
fields it can later expose via UI controls. Everything else
(\`box-shadow\`, \`transform\`, \`letter-spacing\`, \`line-height\`,
\`font-family\`, \`margin\`, \`opacity\`, animations, gradients, …)
round-trips through the file untouched AND is applied to the rendered
element on the canvas. Pseudo-selectors (\`:hover\`) and at-rules
(\`@media\`, \`@keyframes\`) are not parsed and should not be added.

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

Reference tokens in module CSS files using \`var()\`:
\`\`\`css
.button {
  background-color: var(--color-primary);
  color: var(--color-text);
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
 * Default home.tsx content for a freshly created page.
 */
export const defaultPageTsx = (componentName: string, moduleName: string): string => {
  return `import styles from './${moduleName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root}>
    </div>
  );
}
`;
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
