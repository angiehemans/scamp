// templates/agentMd.ts — CLAUDE.md stub + the agent.md guidance templates (legacy + nextjs).
// Split out of src/shared/agentMd.ts (4.6); re-exported via the barrel.

/**
 * Stub `CLAUDE.md` written alongside `agent.md`. Claude Code reads
 * `CLAUDE.md` automatically at session start, and its `@./agent.md`
 * import syntax pulls the full agent.md content into context — so
 * sessions land with the Scamp guidance already loaded instead of
 * relying on the agent to remember to read `agent.md` first. The
 * stub itself stays tiny so the on-disk story is "agent.md is the
 * source of truth, CLAUDE.md just routes the loader to it".
 *
 * Same managed-file disclaimer + refresh-on-open behaviour as
 * agent.md — there's nothing in here for a user to customise.
 */
export const CLAUDE_MD_CONTENT = `<!-- This file is managed by Scamp and refreshed on every project open. Edits made by hand will be overwritten. -->

# Scamp Project — Claude Code Loader

This file exists so Claude Code auto-loads the Scamp agent
instructions on session start. The real content lives in
\`agent.md\`; the import below pulls it in.

@./agent.md
`;


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
export const AGENT_MD_CONTENT_LEGACY = `<!-- This file is managed by Scamp and refreshed on every project open. Edits made by hand will be overwritten. -->

# Scamp Project — Agent Instructions

You are editing files in a Scamp project. Scamp is a local design tool
that bidirectionally syncs canvas state with real \`.tsx\` + CSS module
files. Anything you write here is parsed and re-rendered on the canvas.

## TL;DR

- Edit CSS first, then TSX. Always. Same file write should look like:
  CSS save → wait → TSX save.
- Every Scamp element is a JSX node with both \`data-scamp-id="…"\` AND
  \`className={styles.…}\` matching the same string.
- The \`_XXXX\` suffix is real hex (\`0-9 a-f\`), e.g. \`_a1b2\`. Not
  \`_n001\`, not \`_s002\`, not your own counter.
- Before referencing a token, check it exists in \`theme.css\`. Add
  missing tokens to \`theme.css\` first; never inline raw hex / rgba
  in module CSS.
- Prefer typed property values (px / rem, single \`font-size\` +
  breakpoint overrides) over \`clamp()\`, \`ch\`, or \`flex\` shorthand
  — those render fine but lock the user out of Scamp's panel
  controls. See "Editability — prefer typed properties."
- One CSS class = one rule block. No combined selectors, no nested
  \`@media\`.
- **Use flexbox for layout.** \`display: flex\` + \`flex-direction\` +
  \`gap\` is the default container pattern. Reach for grid only when
  you genuinely need a 2D template, and for absolute positioning
  only for overlays / fixed nav / decorative pseudo-elements. Never
  use absolute positioning as your primary layout strategy.
- If a class block already has rules in CSS, Scamp will leave it
  alone. Scamp only auto-creates EMPTY blocks for classes that
  appear in the TSX but aren't in the CSS yet.
- Anything Scamp doesn't model in its UI controls
  (\`transform\`, \`backdrop-filter\`, \`@keyframes\`, comments, etc.)
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

## Editing alongside Scamp (safe to do)

Scamp's bidirectional sync is designed for an agent and the canvas
to coexist. When you (or any external editor — Claude Code, vim, an
IDE) write to a project file while Scamp is open, Scamp pauses its
own canvas-driven writes until your edits settle. You don't need to
close Scamp to make a change.

Concretely:

- The moment Scamp's file watcher sees an external write, the sync
  engine enters a paused state. The toolbar indicator turns blue
  and reads "Paused."
- Subsequent writes from the same agent (typical: 2-5 in a row as
  the agent iterates) extend the pause window. Scamp waits until
  ~2.5s after the last external write before resuming.
- If the user kept editing the canvas during the pause, Scamp shows
  a "Diverged" state when the pause clears. The user picks Save
  canvas (force overwrite disk) or Discard canvas (reload from
  disk). The agent's writes are NEVER silently overwritten.
- If Scamp's integrated terminal hosts the agent process (Linux /
  macOS), Scamp also pauses as soon as the agent process starts —
  even before the first write — so the first write never races.

What this means for the agent: write naturally, save when you're
done with a logical change, and don't worry about Scamp's canvas
state. Scamp will catch up.

## Critical rules
- Never remove \`data-scamp-id\` attributes from any element.
- Never change the 4-char hex suffix of a class name (e.g. the \`a1b2\`
  in \`hero_card_a1b2\`) — it's the element's unique identifier.
- **Every \`data-scamp-id\` MUST be unique within the page.** When you
  duplicate or copy an element, generate a fresh random 4-char hex
  for the new one — never reuse an existing id. Each id ⇒ exactly
  one JSX element ⇒ exactly one CSS class block. Duplicate ids
  produce an invalid file: Scamp's parser keeps only the last
  occurrence of each id and silently drops the earlier ones, so the
  canvas and the file will visibly disagree.
- Never combine multiple selectors into one rule block
  (\`.a, .b { … }\` will be misread).
- Never nest \`@media\` inside a class rule — only the top-level form
  is parsed (see "Responsive breakpoints").
- One class = one rule block, always.
- \`data-scamp-id\` must always match the CSS class name exactly.
- Renaming an element? Change its class name in BOTH files in the SAME
  edit — the \`.tsx\` (\`className\` AND \`data-scamp-id\`) and the
  \`.module.css\` selector. (Scamp can recover a one-sided rename via the
  shared 4-char hex id, but only while that id is unchanged on both sides.)
- Put element states on the element's OWN class —
  \`.card_a1b2:hover { … }\` — which Scamp parses into an editable state. A
  cross-element interaction (\`.card_a1b2:hover .arrow_c3d4 { … }\`) is kept
  verbatim but is NOT editable on the canvas; keep any such block
  self-contained and valid (every declaration ends in \`;\`).

### Each rendered element needs its OWN unique class

A common mistake is to treat a className like a reusable "type"
or "component class" — defining \`.card\` once and reusing it on
ten sibling \`<div>\`s. **That does not work in Scamp.**

Every JSX element you render is a separate element on the
canvas, and every element needs its own unique
\`data-scamp-id\` + className pair, where the class name ends in
its own fresh 4-char hex suffix.

❌ WRONG — reusing one class across siblings, omitting
\`data-scamp-id\` on duplicates, and skipping the hex suffix:

\`\`\`tsx
<ul className={styles.card_list}>
  <li data-scamp-id="card_row" className={styles.card_row}>Scamp</li>
  <li className={styles.card_row}>Figma</li>
  <li className={styles.card_row}>Framer</li>
</ul>
\`\`\`

Scamp's parser sees one element here (the first \`<li>\`), drops
the rest, and the canvas will not match the file.

✅ RIGHT — every visible element gets its own id+class with a
unique hex suffix. If the rows share styles, write the rule
ONCE in CSS keyed off the parent (e.g. \`.card_list_x1y2 > li\`)
or just repeat the declarations in each block:

\`\`\`tsx
<ul data-scamp-id="card_list_x1y2" className={styles.card_list_x1y2}>
  <li data-scamp-id="card_row_a1b2" className={styles.card_row_a1b2}>Scamp</li>
  <li data-scamp-id="card_row_c3d4" className={styles.card_row_c3d4}>Figma</li>
  <li data-scamp-id="card_row_e5f6" className={styles.card_row_e5f6}>Framer</li>
</ul>
\`\`\`

The same applies to every level of nesting — buttons, list
items, repeated cards, table rows. If you'd render N copies on
the page, you need N unique class names, each with its own hex
suffix and its own \`data-scamp-id\`.

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
- The last \`_XXXX\` segment is always a 4-character hex id — digits
  \`0-9\` and lowercase letters \`a-f\` only. Never \`g-z\`, never
  uppercase, never an incrementing counter. Never change an
  existing id.
  - ✅ \`_a1b2\`, \`_c3d4\`, \`_ff12\`, \`_e5f6\`, \`_b001\`, \`_c101\`
  - ❌ \`_n001\` (\`n\` not hex), \`_h003\`, \`_s002\`, \`_w005\`, \`_x004\`
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

### Layout: flex first, always

**Use flexbox for layout unless the user explicitly asks for
something else.** This is the single most important layout rule in
Scamp. The canvas, the panel controls, and the round-trip parser are
all built around flex as the default container model.

- A container with multiple children should set
  \`display: flex\` on the parent. Pick \`flex-direction\` (row /
  column), \`gap\`, \`align-items\`, and \`justify-content\` to lay them
  out. Don't reach for grid or absolute positioning first.
- **CSS grid is allowed**, but reserve it for the specific cases
  flex can't express cleanly: 2D grids with both row AND column
  alignment constraints (e.g. a 4×3 photo grid), or templates with
  named areas. A simple two-column "image left, text right" layout
  is flex, not grid.
- **Absolute positioning is for special cases only** — overlays,
  toasts, fixed nav bars, decorative pseudo-elements (\`::before\` /
  \`::after\` badges). Never use \`position: absolute\` as your
  primary layout strategy for siblings inside a container; that's
  what flex is for. A row of cards is flex; an overlay on top of an
  image is absolute.
- **No \`float\`, no table layout, no inline-block hacks.** Flex (or
  grid when justified) covers every modern layout need.
- Flex parents render correctly on the Scamp canvas AND are
  editable from the panel's Layout control. Grid and absolute
  layouts still render but expose fewer controls to the user.

When in doubt: \`display: flex\` plus \`flex-direction\` plus \`gap\`.

### Other CSS rules

- One property per line.
- **Every declaration ends with a semicolon, including the last one
  in a block.** Browsers tolerate a missing trailing semicolon but
  Scamp's parser doesn't always — and worse, missing semicolons
  between declarations turn the whole block into one malformed
  declaration that the browser silently drops. Especially watch
  this in \`::before\` / \`::after\` rules, which are easy to write
  by hand without semis:
  \`\`\`css
  /* ❌ wrong — entire block fails to parse, no bullet renders */
  .item::before {
    content: "—"
    position: absolute
    left: 0
  }
  /* ✅ correct */
  .item::before {
    content: "—";
    position: absolute;
    left: 0;
  }
  \`\`\`
- Shorthand is fine (\`border: 1px solid #ccc\`, \`padding: 16px 24px\`).
- The page root is a regular rectangle in Scamp — it defaults to
  \`width: 100%\`, \`min-height: 100vh\`, and \`position: relative\` so the
  exported component fills any browser viewport and absolute children
  paint over a visible box. Scamp does NOT write the canvas viewport
  size (1440, 768, etc.) into \`.root\` — that's a design-tool
  preference stored separately in \`scamp.config.json\`. The canvas is
  a browser-window simulator (like Chrome DevTools' responsive mode);
  the deployed page is meant to work at any width. Don't re-introduce
  fixed pixel dimensions on \`.root\` unless the user specifically
  wants a fixed-width page.
- Width / height values:
  - \`width: 100%\` and \`height: 100%\` mean stretch to fill the parent.
  - \`width: fit-content\` and \`height: fit-content\` mean shrink to content.
  - \`width: auto\` / \`height: auto\` (or simply omitting the
    declaration) leaves the dimension up to normal CSS layout.
  - Pixel values (\`width: 320px\`) are explicit fixed sizes.
- Inside a flex parent, the flex layout engine takes over and
  positional declarations on the child are ignored. Same applies to
  grid children inside a grid container.
- For free-form containers (no flex / no grid), Scamp falls back to
  positioning children with \`position: absolute; left: Xpx; top: Ypx;\`.
  This is the FALLBACK, not the default — prefer flex (see Layout
  above). When you DO need absolute positioning (overlays, fixed
  nav), Scamp respects whatever \`position\` value you wrote
  (\`fixed\`, \`sticky\`, \`relative\`, \`absolute\`, \`static\`).
- **New text elements take their default font from the theme.** When
  you create a text element, set \`font-family: var(--font-sans);\` on
  its class so it inherits the project's default font. If the
  project doesn't declare \`--font-sans\` (an older project, or the
  user deleted it), fall back to the literal system stack:
  \`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"\`.
  The user can override per-element from the panel — your job is to
  pick the project's default at creation time, not to dictate.
- **New text elements default to \`width: fit-content\` and
  \`height: fit-content\`** so the box hugs the text. This way the
  user can change the font size and the box reflows automatically —
  no clipped descenders, no trapped whitespace. If the user later
  switches to a fixed width / height from the panel, that's their
  call; don't pre-emptively pin dimensions on text.
- **\`box-sizing: border-box\` is on by default** via a universal
  reset in \`theme.css\` (\`*, *::before, *::after\`). \`width: 100%\`
  plus \`padding\` works the way you'd expect — the padding sits
  inside the element's declared width, not outside it. Don't
  redeclare \`box-sizing\` per element; rely on the reset.

## CSS properties
Use any CSS property you'd use in a real stylesheet. Scamp renders
**every** valid CSS property on the canvas — there's no allow-list.

Internally Scamp routes a small set of properties (\`background\`,
\`border\`, \`border-radius\`, \`color\`, \`display\`, \`flex-direction\`,
\`align-items\`, \`justify-content\`, \`gap\`, \`width\`, \`height\`,
\`padding\`, \`margin\`, \`opacity\`, \`position\`, \`font-size\`,
\`font-weight\`, \`text-align\`, \`line-height\`, \`letter-spacing\`,
\`font-family\`, \`transition\`, \`box-shadow\`, \`mix-blend-mode\`,
\`background-blend-mode\`, plus the grid container/item set) into
typed fields it can later expose via UI controls. Everything else
(\`transform\`, \`backdrop-filter\`, \`filter\`, \`clip-path\`,
\`isolation\`, animations, gradients, \`@keyframes\`, …) round-trips
through the file untouched AND is applied to the rendered element on
the canvas.

\`mix-blend-mode\` blends through to the page root by default.
Add \`isolation: isolate\` to a parent element to cap the blend at
that container — useful when you want a multiply-blended card
that doesn't bleed onto the page background. Scamp doesn't model
\`isolation\` as a typed field; it round-trips verbatim via
\`customProperties\` and renders natively on the canvas.

### Editability — prefer typed properties

Properties NOT in the typed-fields list above render correctly on
the canvas but the user can't adjust them from the panel — they'd
have to drop into code. Reach for the typed form when you have a
choice so the design stays tweakable from the canvas.

**Typography — avoid \`clamp()\`. Use a base value + named
breakpoint overrides.** Scamp's font-size control reads a single
number. \`clamp(min, preferred, max)\` is stored as a raw string and
the panel can't dial it. For responsive type, pick the desktop size
as the base and override at smaller widths (default Scamp
breakpoints: 768, 390):

\`\`\`css
.hero_title_a1b2 {
  font-size: 5.5rem;
}

@media (max-width: 768px) {
  .hero_title_a1b2 {
    font-size: 3.5rem;
  }
}

@media (max-width: 390px) {
  .hero_title_a1b2 {
    font-size: 2.5rem;
  }
}
\`\`\`

**Sizing — stick to px, rem, %, and Scamp's special modes.** Scamp's
size parser types \`Npx\`, percentages, \`auto\`, \`fit-content\`, and
the special \`100%\` / \`100vh\` modes. Other units — \`ch\`, \`em\`,
arbitrary \`vh\` / \`vw\` — are stored as raw values; the panel shows
the leading number but loses the unit when the user edits it. For
"limit a paragraph to ~52 characters of body text," write
\`max-width: 32rem\` instead of \`max-width: 52ch\`.

**Padding, margin, gap, border-radius, border-width — tokens are
first-class.** Scamp's shorthand parsers for these properties accept
plain px values AND \`var(--token)\` references, including mixed
forms across sides (\`padding: 16px var(--space-md) 16px var(--space-md)\`).
The panel's spacing controls round-trip both forms; tokens emit
verbatim into the saved CSS.

Other CSS units in these properties (\`rem\`, \`em\`, \`%\`, \`auto\`,
\`vh\`, \`vw\`, \`calc(...)\`) still fall into the passthrough bucket
and aren't editable from the panel — they render correctly but the
typed controls go blank. Stick to px or \`var(--token)\` if you want
the user to be able to tweak the value on canvas.

**Flex children — layout lives on the parent, not on each child.**
The typed-properties list covers parent-side flex (\`display\`,
\`flex-direction\`, \`gap\`, \`align-items\`, \`justify-content\`). It
does NOT include \`flex\`, \`flex-grow\`, \`flex-shrink\`,
\`flex-basis\`, or \`align-self\` on the child. Per-child flex
declarations work in the browser but are invisible to the panel.

- ❌ \`flex: 1 1 200px;\` on every card — preserved verbatim, not editable.
- ✅ Parent: \`display: flex; flex-wrap: wrap; gap: var(--space-md);\`.
  Children: \`width: 320px;\` (or whatever fixed width). The parent's
  wrap + gap handles the responsive break, and the user can drag
  card widths on canvas.

For "stretch this child to fill the row," the parent's default
\`align-items: stretch\` already does it — no per-child override.

**Vendor prefixes.** When a property needs a vendor prefix for
browser support (\`-webkit-backdrop-filter\` for Safari, etc.), write
both lines so the design renders on every browser:

\`\`\`css
.nav_a1b2 {
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
\`\`\`

Scamp round-trips prefixed declarations verbatim through
\`customProperties\`.

**Lists — be explicit about markers.** \`<ul>\` / \`<ol>\` inherit
browser-default bullets. The reset block zeros their margin but not
\`list-style\`. Decide which you want and write it down:

- Keep markers: \`list-style: disc;\` (or \`decimal\` for \`<ol>\`) on
  the \`<ul>\` class. Explicit beats relying on browser defaults.
- Drop markers: \`list-style: none;\` on the \`<ul>\` class, then
  style each bullet on its own \`<li>\` class (padding +
  background-image, or an inline \`<svg>\` child). **Avoid \`> li::before\`
  compound selectors** — they render in the browser but aren't
  panel-editable, so the user can't tweak the bullet from the canvas.

\`var(--token)\` works anywhere a CSS value works, including inside
shorthand declarations like \`padding: var(--space-3) var(--space-5)\`.
Scamp resolves the variable at render time through \`theme.css\`.

\`:hover\`, \`:focus\`, and \`:active\` on an element's OWN class
(\`.card_a1b2:hover { … }\`) are parsed into editable per-state overrides —
tweakable from the panel. Other pseudo-selectors (\`:nth-child\`,
\`::before\`), descendant / combined forms (\`.a:hover .b { … }\`), and
at-rules other than \`@media (max-width: Npx)\` are preserved verbatim but
not parsed into the canvas model.

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

## Animations

Scamp models the \`animation\` shorthand as a typed field on each
element. The shorthand emits and parses in the canonical order:

\`\`\`css
.rect_a1b2 {
  animation: fade-in-up 300ms ease forwards;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
\`\`\`

Rules for agents:

- **\`@keyframes\` blocks live AFTER the per-element class blocks**
  but BEFORE any \`@media\` queries. Order: base classes → state
  pseudo-class blocks → custom selector blocks → \`@keyframes\` →
  \`@media\` → preserved-verbatim media blocks.
- **Preset names** Scamp's picker recognises: \`fade-in\`,
  \`fade-in-up\`, \`fade-in-down\`, \`slide-in-left\`,
  \`slide-in-right\`, \`scale-in\`, \`bounce-in\`, \`fade-out\`,
  \`fade-out-up\`, \`slide-out-left\`, \`slide-out-right\`,
  \`scale-out\`, \`pulse\`, \`shake\`, \`bounce\`, \`spin\`, \`ping\`,
  \`float\`, \`wiggle\`. Agents can use these names directly and
  Scamp will recognise them in the picker if the keyframes body
  matches the canonical version.
- **Custom-named animations** round-trip cleanly — Scamp marks them
  as "Custom" in the picker but doesn't touch them.
- **Multi-animation source** (\`animation: a 1s, b 2s\`) round-trips
  via the \`customProperties\` passthrough; the panel can't model the
  multi case but the value stays intact.
- **\`@keyframes\` blocks aren't auto-removed** when no element
  references them — Scamp leaves them on disk so agents can apply
  them later without reauthoring.

### Per-state animations

Animations work inside state blocks too:

\`\`\`css
.button:hover {
  animation: shake 500ms ease-in-out;
}
\`\`\`

CSS triggers the animation on hover-enter and **re-triggers it every
time the user re-enters hover** (the \`:hover\` declaration drops on
hover-leave). This is fine for one-shot motion (\`shake\`, \`pulse\`
once) but unusual for infinite loops — \`spin\` would reset on every
re-hover. For continuous loops, declare the animation on the base
state, not on \`:hover\`.

### Per-breakpoint animations

Per-breakpoint animations aren't typed — Scamp's picker only edits
the base and per-state animations. An agent-written
\`@media (max-width: 768px) { .foo { animation: spin 1s; } }\` block
round-trips verbatim but isn't editable from the panel.

## CSS Variables and Tokens

The project includes a \`theme.css\` file with five sections:

1. **Font imports** — optional \`@import url(...)\` lines at the top
   referencing Google Fonts (\`fonts.googleapis.com\`) or Adobe Fonts
   kits (\`use.typekit.net/<kit-id>.css\`). Scamp's Fonts panel
   manages these.
2. **Design tokens** — CSS custom properties inside \`:root\`. Includes
   a \`--font-sans\` stack used as the page-wide default font.
3. **Box-sizing reset** — a universal \`*, *::before, *::after { box-sizing: border-box; }\`
   rule so \`width: 100%\` plus padding renders the way modern CSS
   frameworks expect (padding sits inside the declared width).
4. **Body defaults** — a single \`body\` rule that applies
   \`--font-sans\` so an unstyled element renders in the project's
   default font everywhere (preview, \`next dev\`, production).
5. **Browser-default reset** — a marked-with-comment block that
   zeros margins on block-level semantic tags (\`p\`, \`h1\`–\`h6\`,
   \`ul\`, \`ol\`, etc.), forces \`display: block\` on replaced media
   (\`img\`, \`video\`, \`iframe\`, \`svg\`), and \`all: unset\`s
   interactive / form tags (\`button\`, \`a\`, \`select\`, \`input\`,
   \`textarea\`, \`fieldset\`, \`legend\`). Mirrors what the canvas
   renderer applies inline so canvas and preview show identical
   unstyled output. The block is preceded by the sentinel comment
   \`/* scamp: browser reset — keep canvas and preview in sync */\`.

\`\`\`css
/* scamp: font imports — managed by Project Settings → Fonts */
@import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");

:root {
  --color-primary: #3b82f6;
  --color-text: #111111;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

/* scamp: browser reset — keep canvas and preview in sync */
p, h1, h2, h3, h4, h5, h6, ul, ol, dl, dd,
blockquote, figure, pre, hr, fieldset {
  margin: 0;
}
img, video, iframe, svg { display: block; }
button, a, select, input, textarea, fieldset, legend {
  all: unset;
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  display: block;
}
input, textarea, select { cursor: text; user-select: text; }
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

Changing \`--font-sans\` updates the page-wide default font. Per-element
overrides (a \`font-family\` declaration on a class) win over this
default. Do not delete the \`body\` rule — it's how unstyled text
elements pick up the project's default font.

The browser-default reset is what makes Scamp's "what you see on the
canvas is what you get in the deployed page" promise hold. Browsers
add 1em of margin to \`<p>\`, default chrome to \`<button>\`, etc.;
the canvas zeros all of that via inline style; this block does the
same in CSS so both surfaces match. Editing or extending the rules
is fine, but **do not delete the sentinel comment** — Scamp uses it
to detect the block on project open and avoid reinserting a duplicate.

**Reference only tokens that already exist in \`theme.css\`.** A
\`var(--…)\` reference to an undeclared token resolves to the
property's *initial* value — e.g. \`padding: var(--space-md)\`
becomes \`0\`, \`background: var(--color-card-bg)\` becomes transparent,
\`max-width: var(--max-width)\` becomes \`none\`. The layout collapses
and the page looks broken on the canvas.

**Before writing any module CSS, read \`theme.css\` and note what
tokens exist.** A fresh project only ships \`--color-primary\`,
\`--color-text\`, and \`--font-sans\` — most real layouts need more
(spacing scale, surface / border / accent colors, max-width, etc.).

**When you need a token that doesn't exist yet, add it to
\`theme.css\` first, then reference it.** Adding tokens is fine and
expected. What's NOT OK:

- Referencing a token that isn't declared anywhere.
- Inlining raw hex / rgba / hsl literals in module CSS to skip the
  theme step. Use a token for any color or scale value, even
  one-off ones. Genuine single-use literals (a brand mark's exact
  hex, a specific illustration tint) can stay literal — flag with
  a comment when you do.

Example: a layout needs accent shadows. Add
\`--shadow-card: 0 16px 40px rgba(0, 0, 0, 0.08);\` to \`theme.css\`,
then write \`box-shadow: var(--shadow-card);\` in the module file.

Do NOT change or remove existing token values without the user
asking — that's a design-system overhaul, not a layout edit.

## Project config

Each project also has a \`scamp.config.json\` file at the root. It holds
per-project settings like the artboard background colour. Scamp
reads and writes this file; don't modify it unless the user asks.

## Snapshot history

Scamp saves snapshots of the project in a \`.scamp/\` folder.
Do not modify or delete anything inside \`.scamp/\`.
Do not add \`.scamp/\` to version control — it is already in \`.gitignore\`.

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
 * `agent.md` written into projects using the Next.js App Router layout
 * (the default for new projects). Differs from the legacy template in
 * project structure, asset path conventions, and the list of files
 * agents should leave alone.
 */
export const AGENT_MD_CONTENT = `<!-- This file is managed by Scamp and refreshed on every project open. Edits made by hand will be overwritten. -->

# Scamp Project — Agent Instructions

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
- The \`_XXXX\` suffix is real hex (\`0-9 a-f\`), e.g. \`_a1b2\`. Not
  \`_n001\`, not \`_s002\`, not your own counter.
- Before referencing a token, check it exists in \`theme.css\`. Add
  missing tokens to \`theme.css\` first; never inline raw hex / rgba
  in module CSS.
- Prefer typed property values (px / rem, single \`font-size\` +
  breakpoint overrides) over \`clamp()\`, \`ch\`, or \`flex\` shorthand
  — those render fine but lock the user out of Scamp's panel
  controls. See "Editability — prefer typed properties."
- One CSS class = one rule block. No combined selectors, no nested
  \`@media\`.
- **Use flexbox for layout.** \`display: flex\` + \`flex-direction\` +
  \`gap\` is the default container pattern. Reach for grid only when
  you genuinely need a 2D template, and for absolute positioning
  only for overlays / fixed nav / decorative pseudo-elements. Never
  use absolute positioning as your primary layout strategy.
- If a class block already has rules in CSS, Scamp will leave it
  alone. Scamp only auto-creates EMPTY blocks for classes that
  appear in the TSX but aren't in the CSS yet.
- Anything Scamp doesn't model in its UI controls
  (\`transform\`, \`backdrop-filter\`, \`@keyframes\`, comments, etc.)
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

## Editing alongside Scamp (safe to do)

Scamp's bidirectional sync is designed for an agent and the canvas
to coexist. When you (or any external editor — Claude Code, vim, an
IDE) write to a project file while Scamp is open, Scamp pauses its
own canvas-driven writes until your edits settle. You don't need to
close Scamp to make a change.

Concretely:

- The moment Scamp's file watcher sees an external write, the sync
  engine enters a paused state. The toolbar indicator turns blue
  and reads "Paused."
- Subsequent writes from the same agent (typical: 2-5 in a row as
  the agent iterates) extend the pause window. Scamp waits until
  ~2.5s after the last external write before resuming.
- If the user kept editing the canvas during the pause, Scamp shows
  a "Diverged" state when the pause clears. The user picks Save
  canvas (force overwrite disk) or Discard canvas (reload from
  disk). The agent's writes are NEVER silently overwritten.
- If Scamp's integrated terminal hosts the agent process (Linux /
  macOS), Scamp also pauses as soon as the agent process starts —
  even before the first write — so the first write never races.

What this means for the agent: write naturally, save when you're
done with a logical change, and don't worry about Scamp's canvas
state. Scamp will catch up.

## Critical rules
- Never remove \`data-scamp-id\` attributes from any element.
- Never change the 4-char hex suffix of a class name (e.g. the \`a1b2\`
  in \`hero_card_a1b2\`) — it's the element's unique identifier.
- **Every \`data-scamp-id\` MUST be unique within the page.** When you
  duplicate or copy an element, generate a fresh random 4-char hex
  for the new one — never reuse an existing id. Each id ⇒ exactly
  one JSX element ⇒ exactly one CSS class block. Duplicate ids
  produce an invalid file: Scamp's parser keeps only the last
  occurrence of each id and silently drops the earlier ones, so the
  canvas and the file will visibly disagree.
- Never combine multiple selectors into one rule block
  (\`.a, .b { … }\` will be misread).
- Never nest \`@media\` inside a class rule — only the top-level form
  is parsed (see "Responsive breakpoints").
- One class = one rule block, always.
- \`data-scamp-id\` must always match the CSS class name exactly.
- Renaming an element? Change its class name in BOTH files in the SAME
  edit — the \`.tsx\` (\`className\` AND \`data-scamp-id\`) and the
  \`.module.css\` selector. (Scamp can recover a one-sided rename via the
  shared 4-char hex id, but only while that id is unchanged on both sides.)
- Put element states on the element's OWN class —
  \`.card_a1b2:hover { … }\` — which Scamp parses into an editable state. A
  cross-element interaction (\`.card_a1b2:hover .arrow_c3d4 { … }\`) is kept
  verbatim but is NOT editable on the canvas; keep any such block
  self-contained and valid (every declaration ends in \`;\`).

### Each rendered element needs its OWN unique class

A common mistake is to treat a className like a reusable "type"
or "component class" — defining \`.card\` once and reusing it on
ten sibling \`<div>\`s. **That does not work in Scamp.**

Every JSX element you render is a separate element on the
canvas, and every element needs its own unique
\`data-scamp-id\` + className pair, where the class name ends in
its own fresh 4-char hex suffix.

❌ WRONG — reusing one class across siblings, omitting
\`data-scamp-id\` on duplicates, and skipping the hex suffix:

\`\`\`tsx
<ul className={styles.card_list}>
  <li data-scamp-id="card_row" className={styles.card_row}>Scamp</li>
  <li className={styles.card_row}>Figma</li>
  <li className={styles.card_row}>Framer</li>
</ul>
\`\`\`

Scamp's parser sees one element here (the first \`<li>\`), drops
the rest, and the canvas will not match the file.

✅ RIGHT — every visible element gets its own id+class with a
unique hex suffix. If the rows share styles, write the rule
ONCE in CSS keyed off the parent (e.g. \`.card_list_x1y2 > li\`)
or just repeat the declarations in each block:

\`\`\`tsx
<ul data-scamp-id="card_list_x1y2" className={styles.card_list_x1y2}>
  <li data-scamp-id="card_row_a1b2" className={styles.card_row_a1b2}>Scamp</li>
  <li data-scamp-id="card_row_c3d4" className={styles.card_row_c3d4}>Figma</li>
  <li data-scamp-id="card_row_e5f6" className={styles.card_row_e5f6}>Framer</li>
</ul>
\`\`\`

The same applies to every level of nesting — buttons, list
items, repeated cards, table rows. If you'd render N copies on
the page, you need N unique class names, each with its own hex
suffix and its own \`data-scamp-id\`.

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
- **Shared root layout**: \`app/layout.tsx\` — do not modify. The
  auto-generated layout sets \`<body style={{ margin: 0, minHeight:
  '100vh' }}>\` so the design isn't pushed off-axis by the browser's
  default body margin and the body fills the viewport in any browser.
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
- The last \`_XXXX\` segment is always a 4-character hex id — digits
  \`0-9\` and lowercase letters \`a-f\` only. Never \`g-z\`, never
  uppercase, never an incrementing counter. Never change an
  existing id.
  - ✅ \`_a1b2\`, \`_c3d4\`, \`_ff12\`, \`_e5f6\`, \`_b001\`, \`_c101\`
  - ❌ \`_n001\` (\`n\` not hex), \`_h003\`, \`_s002\`, \`_w005\`, \`_x004\`
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

### Linking between pages

Use absolute paths matching the page slug for internal links — Next.js
App Router routes are absolute, not relative:

- Home page → \`href="/"\`
- A page at \`app/about/page.tsx\` → \`href="/about"\`
- A page at \`app/checkout-flow/page.tsx\` → \`href="/checkout-flow"\`

Plain \`<a href="/<slug>">\` triggers a normal browser navigation. Both
in \`next dev\` and a production build, this works without any
special component (no \`next/link\` import required). Subpaths,
fragments, and query strings (\`/about/team#contact\`,
\`/about?tab=members\`) round-trip cleanly.

For external links use a full URL (\`href="https://example.com"\`) and
add \`target="_blank"\` plus \`rel="noopener noreferrer"\` when the
link should open in a new tab. Inside Scamp's preview window,
external links are routed to the user's system browser
automatically — the preview is scoped to the project.

When a user renames a page, Scamp rewrites every matching
\`href="/<old-slug>"\` (including subpath / query / fragment forms)
across every page in the project. So the canonical href shape is
the load-bearing convention here — keep it consistent.

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

### Layout: flex first, always

**Use flexbox for layout unless the user explicitly asks for
something else.** This is the single most important layout rule in
Scamp. The canvas, the panel controls, and the round-trip parser are
all built around flex as the default container model.

- A container with multiple children should set
  \`display: flex\` on the parent. Pick \`flex-direction\` (row /
  column), \`gap\`, \`align-items\`, and \`justify-content\` to lay them
  out. Don't reach for grid or absolute positioning first.
- **CSS grid is allowed**, but reserve it for the specific cases
  flex can't express cleanly: 2D grids with both row AND column
  alignment constraints (e.g. a 4×3 photo grid), or templates with
  named areas. A simple two-column "image left, text right" layout
  is flex, not grid.
- **Absolute positioning is for special cases only** — overlays,
  toasts, fixed nav bars, decorative pseudo-elements (\`::before\` /
  \`::after\` badges). Never use \`position: absolute\` as your
  primary layout strategy for siblings inside a container; that's
  what flex is for. A row of cards is flex; an overlay on top of an
  image is absolute.
- **No \`float\`, no table layout, no inline-block hacks.** Flex (or
  grid when justified) covers every modern layout need.
- Flex parents render correctly on the Scamp canvas AND are
  editable from the panel's Layout control. Grid and absolute
  layouts still render but expose fewer controls to the user.

When in doubt: \`display: flex\` plus \`flex-direction\` plus \`gap\`.

### Other CSS rules

- One property per line.
- **Every declaration ends with a semicolon, including the last one
  in a block.** Browsers tolerate a missing trailing semicolon but
  Scamp's parser doesn't always — and worse, missing semicolons
  between declarations turn the whole block into one malformed
  declaration that the browser silently drops. Especially watch
  this in \`::before\` / \`::after\` rules, which are easy to write
  by hand without semis:
  \`\`\`css
  /* ❌ wrong — entire block fails to parse, no bullet renders */
  .item::before {
    content: "—"
    position: absolute
    left: 0
  }
  /* ✅ correct */
  .item::before {
    content: "—";
    position: absolute;
    left: 0;
  }
  \`\`\`
- Shorthand is fine (\`border: 1px solid #ccc\`, \`padding: 16px 24px\`).
- The page root is a regular rectangle in Scamp — it defaults to
  \`width: 100%\`, \`min-height: 100vh\`, and \`position: relative\` so the
  exported component fills any browser viewport and absolute children
  paint over a visible box. Scamp does NOT write the canvas viewport
  size (1440, 768, etc.) into \`.root\` — that's a design-tool
  preference stored separately in \`scamp.config.json\`. The canvas is
  a browser-window simulator (like Chrome DevTools' responsive mode);
  the deployed page is meant to work at any width. Don't re-introduce
  fixed pixel dimensions on \`.root\` unless the user specifically
  wants a fixed-width page.
- Width / height values:
  - \`width: 100%\` and \`height: 100%\` mean stretch to fill the parent.
  - \`width: fit-content\` and \`height: fit-content\` mean shrink to content.
  - \`width: auto\` / \`height: auto\` (or simply omitting the
    declaration) leaves the dimension up to normal CSS layout.
  - Pixel values (\`width: 320px\`) are explicit fixed sizes.
- Inside a flex parent, the flex layout engine takes over and
  positional declarations on the child are ignored. Same applies to
  grid children inside a grid container.
- For free-form containers (no flex / no grid), Scamp falls back to
  positioning children with \`position: absolute; left: Xpx; top: Ypx;\`.
  This is the FALLBACK, not the default — prefer flex (see Layout
  above). When you DO need absolute positioning (overlays, fixed
  nav), Scamp respects whatever \`position\` value you wrote
  (\`fixed\`, \`sticky\`, \`relative\`, \`absolute\`, \`static\`).
- **New text elements take their default font from the theme.** When
  you create a text element, set \`font-family: var(--font-sans);\` on
  its class so it inherits the project's default font. If the
  project doesn't declare \`--font-sans\` (an older project, or the
  user deleted it), fall back to the literal system stack:
  \`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"\`.
  The user can override per-element from the panel — your job is to
  pick the project's default at creation time, not to dictate.
- **New text elements default to \`width: fit-content\` and
  \`height: fit-content\`** so the box hugs the text. This way the
  user can change the font size and the box reflows automatically —
  no clipped descenders, no trapped whitespace. If the user later
  switches to a fixed width / height from the panel, that's their
  call; don't pre-emptively pin dimensions on text.
- **\`box-sizing: border-box\` is on by default** via a universal
  reset in \`theme.css\` (\`*, *::before, *::after\`). \`width: 100%\`
  plus \`padding\` works the way you'd expect — the padding sits
  inside the element's declared width, not outside it. Don't
  redeclare \`box-sizing\` per element; rely on the reset.

## CSS properties
Use any CSS property you'd use in a real stylesheet. Scamp renders
**every** valid CSS property on the canvas — there's no allow-list.

Internally Scamp routes a small set of properties (\`background\`,
\`border\`, \`border-radius\`, \`color\`, \`display\`, \`flex-direction\`,
\`align-items\`, \`justify-content\`, \`gap\`, \`width\`, \`height\`,
\`padding\`, \`margin\`, \`opacity\`, \`position\`, \`font-size\`,
\`font-weight\`, \`text-align\`, \`line-height\`, \`letter-spacing\`,
\`font-family\`, \`transition\`, \`box-shadow\`, \`mix-blend-mode\`,
\`background-blend-mode\`, plus the grid container/item set) into
typed fields it can later expose via UI controls. Everything else
(\`transform\`, \`backdrop-filter\`, \`filter\`, \`clip-path\`,
\`isolation\`, animations, gradients, \`@keyframes\`, …) round-trips
through the file untouched AND is applied to the rendered element on
the canvas.

\`mix-blend-mode\` blends through to the page root by default.
Add \`isolation: isolate\` to a parent element to cap the blend at
that container — useful when you want a multiply-blended card
that doesn't bleed onto the page background. Scamp doesn't model
\`isolation\` as a typed field; it round-trips verbatim via
\`customProperties\` and renders natively on the canvas.

### Editability — prefer typed properties

Properties NOT in the typed-fields list above render correctly on
the canvas but the user can't adjust them from the panel — they'd
have to drop into code. Reach for the typed form when you have a
choice so the design stays tweakable from the canvas.

**Typography — avoid \`clamp()\`. Use a base value + named
breakpoint overrides.** Scamp's font-size control reads a single
number. \`clamp(min, preferred, max)\` is stored as a raw string and
the panel can't dial it. For responsive type, pick the desktop size
as the base and override at smaller widths (default Scamp
breakpoints: 768, 390):

\`\`\`css
.hero_title_a1b2 {
  font-size: 5.5rem;
}

@media (max-width: 768px) {
  .hero_title_a1b2 {
    font-size: 3.5rem;
  }
}

@media (max-width: 390px) {
  .hero_title_a1b2 {
    font-size: 2.5rem;
  }
}
\`\`\`

**Sizing — stick to px, rem, %, and Scamp's special modes.** Scamp's
size parser types \`Npx\`, percentages, \`auto\`, \`fit-content\`, and
the special \`100%\` / \`100vh\` modes. Other units — \`ch\`, \`em\`,
arbitrary \`vh\` / \`vw\` — are stored as raw values; the panel shows
the leading number but loses the unit when the user edits it. For
"limit a paragraph to ~52 characters of body text," write
\`max-width: 32rem\` instead of \`max-width: 52ch\`.

**Padding, margin, gap, border-radius, border-width — tokens are
first-class.** Scamp's shorthand parsers for these properties accept
plain px values AND \`var(--token)\` references, including mixed
forms across sides (\`padding: 16px var(--space-md) 16px var(--space-md)\`).
The panel's spacing controls round-trip both forms; tokens emit
verbatim into the saved CSS.

Other CSS units in these properties (\`rem\`, \`em\`, \`%\`, \`auto\`,
\`vh\`, \`vw\`, \`calc(...)\`) still fall into the passthrough bucket
and aren't editable from the panel — they render correctly but the
typed controls go blank. Stick to px or \`var(--token)\` if you want
the user to be able to tweak the value on canvas.

**Flex children — layout lives on the parent, not on each child.**
The typed-properties list covers parent-side flex (\`display\`,
\`flex-direction\`, \`gap\`, \`align-items\`, \`justify-content\`). It
does NOT include \`flex\`, \`flex-grow\`, \`flex-shrink\`,
\`flex-basis\`, or \`align-self\` on the child. Per-child flex
declarations work in the browser but are invisible to the panel.

- ❌ \`flex: 1 1 200px;\` on every card — preserved verbatim, not editable.
- ✅ Parent: \`display: flex; flex-wrap: wrap; gap: var(--space-md);\`.
  Children: \`width: 320px;\` (or whatever fixed width). The parent's
  wrap + gap handles the responsive break, and the user can drag
  card widths on canvas.

For "stretch this child to fill the row," the parent's default
\`align-items: stretch\` already does it — no per-child override.

**Vendor prefixes.** When a property needs a vendor prefix for
browser support (\`-webkit-backdrop-filter\` for Safari, etc.), write
both lines so the design renders on every browser:

\`\`\`css
.nav_a1b2 {
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
\`\`\`

Scamp round-trips prefixed declarations verbatim through
\`customProperties\`.

**Lists — be explicit about markers.** \`<ul>\` / \`<ol>\` inherit
browser-default bullets. The reset block zeros their margin but not
\`list-style\`. Decide which you want and write it down:

- Keep markers: \`list-style: disc;\` (or \`decimal\` for \`<ol>\`) on
  the \`<ul>\` class. Explicit beats relying on browser defaults.
- Drop markers: \`list-style: none;\` on the \`<ul>\` class, then
  style each bullet on its own \`<li>\` class (padding +
  background-image, or an inline \`<svg>\` child). **Avoid \`> li::before\`
  compound selectors** — they render in the browser but aren't
  panel-editable, so the user can't tweak the bullet from the canvas.

\`var(--token)\` works anywhere a CSS value works, including inside
shorthand declarations like \`padding: var(--space-3) var(--space-5)\`.
Scamp resolves the variable at render time through \`app/theme.css\`.

\`:hover\`, \`:focus\`, and \`:active\` on an element's OWN class
(\`.card_a1b2:hover { … }\`) are parsed into editable per-state overrides —
tweakable from the panel. Other pseudo-selectors (\`:nth-child\`,
\`::before\`), descendant / combined forms (\`.a:hover .b { … }\`), and
at-rules other than \`@media (max-width: Npx)\` are preserved verbatim but
not parsed into the canvas model.

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

## Animations

Scamp models the \`animation\` shorthand as a typed field on each
element. The shorthand emits and parses in the canonical order:

\`\`\`css
.rect_a1b2 {
  animation: fade-in-up 300ms ease forwards;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
\`\`\`

Rules for agents:

- **\`@keyframes\` blocks live AFTER the per-element class blocks**
  but BEFORE any \`@media\` queries. Order: base classes → state
  pseudo-class blocks → custom selector blocks → \`@keyframes\` →
  \`@media\` → preserved-verbatim media blocks.
- **Preset names** Scamp's picker recognises: \`fade-in\`,
  \`fade-in-up\`, \`fade-in-down\`, \`slide-in-left\`,
  \`slide-in-right\`, \`scale-in\`, \`bounce-in\`, \`fade-out\`,
  \`fade-out-up\`, \`slide-out-left\`, \`slide-out-right\`,
  \`scale-out\`, \`pulse\`, \`shake\`, \`bounce\`, \`spin\`, \`ping\`,
  \`float\`, \`wiggle\`. Agents can use these names directly and
  Scamp will recognise them in the picker if the keyframes body
  matches the canonical version.
- **Custom-named animations** round-trip cleanly — Scamp marks them
  as "Custom" in the picker but doesn't touch them.
- **Multi-animation source** (\`animation: a 1s, b 2s\`) round-trips
  via the \`customProperties\` passthrough; the panel can't model the
  multi case but the value stays intact.
- **\`@keyframes\` blocks aren't auto-removed** when no element
  references them — Scamp leaves them on disk so agents can apply
  them later without reauthoring.

### Per-state animations

Animations work inside state blocks too:

\`\`\`css
.button:hover {
  animation: shake 500ms ease-in-out;
}
\`\`\`

CSS triggers the animation on hover-enter and **re-triggers it every
time the user re-enters hover** (the \`:hover\` declaration drops on
hover-leave). This is fine for one-shot motion (\`shake\`, \`pulse\`
once) but unusual for infinite loops — \`spin\` would reset on every
re-hover. For continuous loops, declare the animation on the base
state, not on \`:hover\`.

### Per-breakpoint animations

Per-breakpoint animations aren't typed — Scamp's picker only edits
the base and per-state animations. An agent-written
\`@media (max-width: 768px) { .foo { animation: spin 1s; } }\` block
round-trips verbatim but isn't editable from the panel.

## CSS Variables and Tokens

The project includes an \`app/theme.css\` file with two sections:

1. **Font imports** — optional \`@import url(...)\` lines at the top
   referencing Google Fonts (\`fonts.googleapis.com\`) or Adobe Fonts
   kits (\`use.typekit.net/<kit-id>.css\`). Scamp's Fonts panel
   manages these.
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

**Reference only tokens that already exist in \`app/theme.css\`.** A
\`var(--…)\` reference to an undeclared token resolves to the
property's *initial* value — e.g. \`padding: var(--space-md)\`
becomes \`0\`, \`background: var(--color-card-bg)\` becomes transparent,
\`max-width: var(--max-width)\` becomes \`none\`. The layout collapses
and the page looks broken on the canvas.

**Before writing any module CSS, read \`app/theme.css\` and note what
tokens exist.** A fresh project only ships \`--color-primary\`,
\`--color-text\`, and \`--font-sans\` — most real layouts need more
(spacing scale, surface / border / accent colors, max-width, etc.).

**When you need a token that doesn't exist yet, add it to
\`app/theme.css\` first, then reference it.** Adding tokens is fine
and expected. What's NOT OK:

- Referencing a token that isn't declared anywhere.
- Inlining raw hex / rgba / hsl literals in module CSS to skip the
  theme step. Use a token for any color or scale value, even
  one-off ones. Genuine single-use literals (a brand mark's exact
  hex, a specific illustration tint) can stay literal — flag with
  a comment when you do.

Example: a layout needs accent shadows. Add
\`--shadow-card: 0 16px 40px rgba(0, 0, 0, 0.08);\` to \`app/theme.css\`,
then write \`box-shadow: var(--shadow-card);\` in the module file.

Do NOT change or remove existing token values without the user
asking — that's a design-system overhaul, not a layout edit.

## Project config

\`scamp.config.json\` at the project root holds per-project settings
like the artboard background colour and breakpoint table. Scamp
reads and writes this file; don't modify it unless the user asks.

## Preview mode

The user can press ⌘P (or click "Preview" in the toolbar) to open
the project in a real Next.js dev server in a separate window.
Scamp runs \`npm install\` automatically on first open, then spawns
\`next dev\` and renders the live URL inside an embedded webview.

Implications for agents:

- The \`package.json\` and \`next.config.ts\` files are essential
  for preview to work. Don't delete them; don't change the
  \`scripts.dev\` entry that Scamp invokes.
- Animations, transitions, and \`:hover\` / \`:active\` / \`:focus\`
  states only run in preview mode (the static canvas doesn't fire
  hover events). When you're testing motion or interactivity, the
  user is most likely viewing it in preview.
- The reserved filename \`[page-name].data.json\` (e.g.
  \`page.data.json\` next to \`app/about/page.tsx\`) is set aside
  for a future feature that injects mock data as page props during
  preview. Don't repurpose this name for unrelated files.

## Snapshot history

Scamp saves snapshots of the project in a \`.scamp/\` folder.
Do not modify or delete anything inside \`.scamp/\`.
Do not add \`.scamp/\` to version control — it is already in \`.gitignore\`.

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

