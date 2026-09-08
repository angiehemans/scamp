# Link between pages

Make any element clickable and link it to another page in your project,
or to an external URL. Scamp routes the destination through the **Link
to** field in the Element section of the
[properties panel](properties-panel.md), marked with a chain icon.

## The Link to field

Select any element. In the **Element** section, the **Link to** row has
a chain icon and a list:

- **None**: No link.
- **Page**: Link to another page in this project. A second list appears
  with every page (Home, About, Dashboard, and so on).
- **External URL**: Link to an absolute URL. A text input appears for the
  URL.

Select a destination, and Scamp writes the link to your TSX
automatically. You don't need to swap the tag or hand-write
`<a href="...">`; the panel handles that.

## What happens to the element's tag

Scamp picks the right action based on the element's current tag:

| Tag | What happens when you select a destination |
|---|---|
| `div`, `span`, `p`, `button` | **Tag swap**: The element's tag becomes `<a>`. The element's class, contents, and styles stay the same. |
| `<img>`, `<video>`, `<iframe>`, `<svg>`, `<input>`, `<textarea>`, `<select>` | **Wrap**: Scamp inserts a new `<a>` element as the parent. The original element becomes its child. |
| Already `<a>` | The destination edits the existing `href`. |
| `<article>`, `<section>`, `<header>`, `<nav>`, `<aside>`, `<main>`, `<footer>`, `<figure>` | The Link to field is **hidden**. Linking a whole section is uncommon; change the tag to `<div>` first if you need to. |

The wrap path adds a new element to the layers panel, which appears
above the wrapped child. The wrapper carries the link; the inner element
keeps its own styles.

## Open in a new tab

Below the destination list, the **Open in new tab** toggle adds
`target="_blank"` to the link, plus `rel="noopener noreferrer"` for
security. It's off by default.

## The canvas chain icon

When a linked element is selected, a small blue chain-link icon appears
in its top-right corner on the canvas. Hold the pointer over it for a
tooltip that shows the destination, such as `Links to /dashboard`. Click
the icon to do the following:

- **Internal link**: Navigate the canvas to the linked page.
- **External link**: Open the URL in your system browser.

The icon appears only on selected elements, so it doesn't clutter the
canvas.

## Broken links

If you link to a page named `dashboard` and later rename or delete that
page, Scamp shows the problem in two places:

- The chain icon turns red with a slash through it. The tooltip reads
  `Links to /dashboard (page not found in this project)`.
- The Link to field shows a warning: `Page /dashboard doesn't exist in
  this project.` The list shows the missing page labeled `(missing)`,
  so you can see and replace it.

Page renames automatically update `href="/<old-slug>"` references across
every page in the project, including subpaths and fragments—for example,
`/about/team#contact` becomes `/landing/team#contact`. Most renames don't
produce broken links in the first place.

## Remove a link

In the destination list, select **None**.

- For elements where Scamp swapped the tag (`div` to `a`), this clears
  the `href`. The tag stays `<a>`; change it back from the tag list if
  you want.
- For elements that Scamp wrapped in an `<a>` parent, a hint pill in the
  panel reads "Wrapped in `/dashboard`" with a **Select link wrapper**
  button. Select the wrapper to delete it or change its destination.

## The generated code

An internal link to the home page:

```tsx
<a data-scamp-id="cta_c001" className={styles.cta_c001} href="/">
  Get started
</a>
```

An external link that opens in a new tab:

```tsx
<a
  data-scamp-id="github_link_g001"
  className={styles.github_link_g001}
  href="https://github.com/scamp"
  target="_blank"
  rel="noopener noreferrer"
>
  GitHub
</a>
```

A wrapped image:

```tsx
<a data-scamp-id="link_wrap_w001" className={styles.link_wrap_w001} href="/about">
  <img data-scamp-id="hero_img_h001" className={styles.hero_img_h001} src="/assets/hero.png" alt="" />
</a>
```

## In preview mode

Every link works exactly as it does in production:

- **Internal links** trigger normal browser navigation. The preview
  window's back and forward buttons walk the navigation history. The URL
  bar updates to show the current page.
- **External links**, and any link with `target="_blank"`, open in your
  system browser, not inside the preview window. The preview is scoped
  to your project.

See [Preview mode](preview.md).

## Page routes

Page routes are absolute paths that match the page name in the project:

| Page in project | URL |
|---|---|
| `home` (the project's root page) | `/` |
| `about` | `/about` |
| `checkout-flow` | `/checkout-flow` |

Subpaths, query strings, and fragments work too. An agent or the
External URL field can produce `/about/team#contact`, and Scamp
round-trips the full `href`.

## Tips

- For buttons that navigate, let Scamp swap the tag. A `<button>` styled
  like a button and swapped to `<a>` is the standard accessible pattern.
  Wrapping a `<button>` inside an `<a>` is invalid HTML.
- For a card where clicking anywhere navigates, use the wrap path on a
  `<div>`. The entire card becomes clickable while keeping its inner
  structure.
- The chain icon's broken-link state is a quick visual scan. If you see
  red icons after a page rename or delete, fix the destinations from the
  panel.
