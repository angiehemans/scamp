# Elements

Every Scamp element is rendered as a real HTML tag in the generated code. By default rectangles are `<div>`, text is `<p>`, images are `<img>`, and inputs are `<input>` — but you can change any element to a more semantic tag from the properties panel.

## Element Types

Scamp has four element types, identified by the class name prefix in the generated CSS:

| Type | Class prefix | Default tag | Toolbar shortcut |
|---|---|---|---|
| Rectangle | `rect_` | `div` | **R** |
| Text | `text_` | `p` | **T** |
| Image / media | `img_` | `img` | **I** |
| Input / form control | `input_` | `input` | **F** |

The class prefix stays the same when you change the tag — a `<nav>` rectangle is still `rect_…`, an `<h1>` text element is still `text_…`. This keeps CSS selectors stable across tag changes.

## Changing the Tag

1. Select an element.
2. In the properties panel, expand the **Element** section at the top.
3. Pick a new tag from the dropdown.

The canvas re-renders immediately with the new tag, and the generated TSX updates.

### Rectangle tags

`div` (default), `section`, `article`, `aside`, `main`, `header`, `footer`, `nav`, `figure`, `form`, `fieldset`, `ul`, `ol`, `li`, `details`, `summary`, `dialog`, `button`, `a`.

### Text tags

`p` (default), `h1`–`h6`, `span`, `label`, `blockquote`, `pre`, `code`, `strong`, `em`, `small`, `time`, `figcaption`, `legend`, `li`.

### Media tags

`img` (default), `video`, `iframe`, `svg`.

### Input tags

`input` (default), `textarea`, `select`.

## Tag-specific Attributes

When you pick a tag that takes attributes, inputs for them appear below the tag dropdown in the Element section:

| Tag | Attributes |
|---|---|
| `a` | `href`, `target` (`_self` / `_blank` / `_parent` / `_top`) |
| `button` | `type` (`button` / `submit` / `reset`) |
| `form` | `method` (`get` / `post`), `action` |
| `label` | `for` (React's `htmlFor`) |
| `blockquote` | `cite` |
| `time` | `datetime` |
| `dialog` | `open` (checkbox) |
| `video` | `src`, `controls`, `autoplay`, `loop`, `muted` |
| `iframe` | `src`, `title` |
| `input` | `type` (text / email / password / number / checkbox / radio / range / date / file), `placeholder` |
| `textarea` | `rows`, `placeholder` |

Boolean attributes (`controls`, `autoplay`, `muted`, `loop`, `open`) are emitted without a value when checked — matching standard HTML.

Any attribute you add manually in the CSS editor or externally round-trips cleanly — Scamp preserves unknown attributes verbatim.

## Select & Option

`<select>` elements have an **Options** editor inside the Element section instead of plain attribute fields. Add, remove, rename, and mark one option as initially selected.

Options live as a typed list on the select element — they're not drawable canvas elements. Editing them through the panel is the only way to change them.

## SVG

SVGs render as real artwork on the canvas — not a placeholder — and the exported TSX contains your source. There are three ways to get one onto the canvas:

- **Drag and drop** an `.svg` file from your file manager. Small icons are inlined as an editable `<svg>` (so you can recolor them); large illustrations are copied into your assets and referenced as an `<img>`.
- **Paste** (**Cmd/Ctrl+V**) SVG markup you've copied from a code editor or design tool. A copied raster image pastes too (saved to your assets).
- Switch any element's tag to `svg` in the Element section and paste markup into its **Source** textarea.

For safety, pasted/dropped SVG is sanitized — `<script>`, event handlers, and external references are stripped before it's added to your canvas.

### Editing fill and stroke

Select an inline SVG and the **SVG** section appears in the Visual panel with **Fill**, **Stroke**, and **Stroke width** controls (theme tokens and `currentColor` supported). These set element-level CSS that cascades to the shapes inside, so you can recolor an icon — fill and stroke independently — without touching the markup.

This works because, on import, Scamp strips the shapes' own hardcoded `fill`/`stroke` so your element-level color wins. (`fill="none"` and gradient references are left intact.) An icon with several distinct hardcoded colors becomes one color when recolored this way — element-level paint is a single fill/stroke, not per-shape.

## List Context Defaults

When you draw a new rectangle or text element inside a `<ul>` or `<ol>`, Scamp sets its tag to `<li>` automatically. You can change it afterwards if needed.

## What Doesn't Change With the Tag

The element's CSS class name, its `data-scamp-id`, and all its styles stay put. The tag is purely semantic — it doesn't affect how Scamp identifies or styles the element.

## Tips

- Use `<nav>` for menus, `<header>` for page hero regions, `<main>` for the primary content column, `<footer>` for the page footer. Semantic tags improve accessibility and SEO without changing your design.
- Heading levels (`h1`–`h6`) should reflect your content hierarchy, not font sizes. Keep font-size controls in the [Typography](typography.md) section.
- `<button>` on the canvas has its default browser chrome reset so it looks like the box you drew. Style it however you want.
