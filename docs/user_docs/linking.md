# Linking Between Pages

Make any element clickable and link it to another page in your project — or to an external URL. Scamp routes the destination through the **Link** field in the [Properties Panel](properties-panel.md)'s Element section, with a leading chain icon so the affordance is unmistakable.

## The Link Field

Select any element. Inside the **Element** section, you'll see a **Link to** row with a chain icon and a dropdown:

- **None** — no link.
- **Page** — link to another page in this project. A second dropdown appears listing every page (Home, About, Dashboard, etc.).
- **External URL** — link to an absolute URL. A text input appears for the URL.

Pick a destination and Scamp writes the link to your TSX automatically. No need to manually swap the tag or hand-write `<a href="...">` — the panel handles that.

## What Happens to the Element's Tag

Scamp picks the right action based on the element's current tag:

| Tag | What happens when you pick a destination |
|---|---|
| `div`, `span`, `p`, `button` | **Tag swap** — the element's tag becomes `<a>`. The element's class, contents, and styles stay the same. |
| `<img>`, `<video>`, `<iframe>`, `<svg>`, `<input>`, `<textarea>`, `<select>` | **Wrap** — Scamp inserts a new `<a>` Scamp element as the parent. The original element becomes its child. |
| Already `<a>` | The destination edits the existing `href`. |
| `<article>`, `<section>`, `<header>`, `<nav>`, `<aside>`, `<main>`, `<footer>`, `<figure>` | The Link field is **hidden**. Linking a whole section is uncommon — change the tag to `<div>` first if you really need to. |

The Wrap path adds a new element to the layers panel — you'll see it appear above the wrapped child. The wrapper carries the link; the inner element keeps its own styles.

## Open in New Tab

Below the destination dropdown, an **Open in new tab** toggle adds `target="_blank"` to the link AND `rel="noopener noreferrer"` for security. Defaults to off.

## The Canvas Chain Icon

When a linked element is **selected**, a small blue chain-link icon appears in its top-right corner on the canvas. Hover for a tooltip showing the destination (`Links to /dashboard`). Click the icon to:

- **Internal link** — navigate the canvas to the linked page.
- **External link** — open the URL in your system browser.

The icon only shows for selected elements so it doesn't clutter the canvas.

## Broken Links

If you link to a page named `dashboard` and later rename or delete that page, Scamp surfaces the problem two ways:

- The chain icon turns **red** with a slash through it. Tooltip: `Links to /dashboard (page not found in this project)`.
- The Link field's panel surfaces a warning: `Page /dashboard doesn't exist in this project.` The dropdown shows the missing page labelled `(missing)` so you can see and replace it.

Page renames automatically refactor `href="/<old-slug>"` references across every page in the project — including subpaths and fragments (e.g. `/about/team#contact` becomes `/landing/team#contact`). So most renames don't produce broken links in the first place.

## Removing a Link

Set the destination dropdown back to **None**.

- For elements where Scamp swapped the tag (`div` → `a`): clears the `href`. The tag stays `<a>` — change it back from the tag dropdown if you want.
- For elements where Scamp wrapped the element in an `<a>` parent: a hint pill in the panel ("Wrapped in `/dashboard`") with a button to **Select link wrapper**. Selecting the wrapper lets you delete the wrapper or change its destination.

## What the Generated Code Looks Like

Internal link to the home page:

```tsx
<a data-scamp-id="cta_c001" className={styles.cta_c001} href="/">
  Get started
</a>
```

External link in a new tab:

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

Wrapped image:

```tsx
<a data-scamp-id="link_wrap_w001" className={styles.link_wrap_w001} href="/about">
  <img data-scamp-id="hero_img_h001" className={styles.hero_img_h001} src="/assets/hero.png" alt="" />
</a>
```

## In Preview Mode

Every link works exactly as it would in production:

- **Internal links** trigger normal browser navigation. The preview window's back / forward buttons let you walk the navigation history. The URL bar updates to show the current page.
- **External links** (and `target="_blank"`) open in your system browser, not inside the preview window. The preview is scoped to your project — external destinations don't belong here.

See [Preview Mode](preview.md).

## Page Routes

Page routes are absolute paths matching the page name in the project:

| Page in project | URL |
|---|---|
| `home` (the project's root page) | `/` |
| `about` | `/about` |
| `checkout-flow` | `/checkout-flow` |

Subpaths, query strings, and fragments work too — the agent or the External URL field can produce `/about/team#contact` and Scamp round-trips the full href cleanly.

## Tips

- For "buttons that navigate", let Scamp swap the tag — a `<button>` styled like a button, swapped to `<a>`, is the canonical accessible pattern. Wrapping a `<button>` inside an `<a>` is invalid HTML.
- For card-style "click anywhere on this card to navigate", use the Wrap path on a `<div>` — the entire card becomes clickable while keeping its inner structure.
- The chain icon's broken-link state is a quick visual scan. If you see red icons after a page rename or delete, fix the destinations from the panel.
