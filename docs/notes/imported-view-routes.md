# An imported view had no URL

## What was seen

The preview loaded a page, and every navigation after it — a link in
the page, or the page picker in the preview toolbar — went white. The
dev server said why:

```
preview: GET /resova-health4 404 3ms
```

## Why

The two project formats serve pages from different places. Next.js
serves `app/<slug>/page.tsx`; the Scamp framework routes from
`routes/`. `createComponent` wrote only the first, with no reference to
the format at all — so in a framework project an imported view landed
on disk, appeared in the layers panel and the page picker, and had no
URL anywhere.

`writeViewUrl` now asks the format. A framework project gets
`routes/<slug>.tsx` with the same shape the migration writes — the
import, the `render` export, and the view — and `home` goes to
`routes/index.tsx` rather than `/home`.

## The thing that made the first attempt wrong

Deleting a view removes its Next.js wrapper, and it seemed obvious that
it should remove the route too: a route importing a view that is no
longer there is a dev server that will not start.

It broke every page rename. Rename is `createComponent(new)` then
`deleteComponent(old)`, and only afterwards `renameRouteForView(old,
new)` — which finds the route by the view it imports and MOVES it.
Removing it during the delete left nothing to move, so a renamed page
ended up with no route at all. One e2e caught it; without that it would
have shipped.

`wrapperSlugFor` says the same thing from the other side, and is worth
reading before touching any of this:

> Only a Next.js project needs a wrapper page; in a scamp-format
> project the route that renders a view lives in routes/, which is the
> user's.

That is why it returns `null` for a framework project, and why the
import — which passes a slug of its own — was the one path that went
wrong. A route is the user's file: an existing one is never
overwritten, and deleting a view leaves it alone.

## Not this bug, though it looked like it

The same session showed a parse error in a view:

```
Expected corresponding JSX closing tag for 'a'.
```

An element opened `<a …>` and closed `</button>`. The generator cannot
produce that — every path takes its tag from one `tagFor(el)` call —
and running the file through `parseCode` → `generateCode` returns it
balanced, as `<a>…</a>`. It was a hand edit: an agent changed the open
tag, left the `type="button"` attribute behind, and missed the close.
Opening the view in Scamp and saving rewrites the file correctly.
