# Views

A view is a page's design, kept in the same file shape as a
[component](components.md): a props type, a function that renders the
markup, and a CSS Module. The view holds the layout and sample data.
The code that renders it, a route in the Scamp framework or a wrapper
page in Next.js, supplies the real data.

Views are how Scamp separates design from logic. You design the page on
the canvas with realistic sample content, and an agent or a developer
writes the route that fetches the data and passes it in. Neither side
edits the other's file.

## Where views live

Each view is two files inside `views/[Name]/`:

```
my-project/
├── app/
│   └── lobby/
│       └── page.tsx          ← a one-line wrapper (Next.js projects only)
├── views/
│   └── Lobby/
│       ├── Lobby.tsx
│       └── Lobby.module.css
└── components/
    └── LinkCard/
```

The view's name is PascalCase, and its page has a route slug: the view
`Lobby` is the page `lobby`, and `AboutUs` is `about-us`.

In a Next.js project, the page file under `app/` is a one-line wrapper
that renders the view. Scamp writes and regenerates that wrapper, so
the page still previews at its route. Don't edit it. In a Scamp
framework project there are no wrapper pages: a route file under
`routes/` renders the view, and Scamp never touches `routes/`. See
[Scamp framework projects](#scamp-framework-projects).

## Views in the sidebar

Views list under **Pages** in the left sidebar by their route slug,
alongside any pages that haven't been converted yet. Click a view to
open it on the canvas. The canvas, properties panel, and code panel
work as they do for a page.

The artboard opens at the project's page width (the artboard size in
[Settings](settings.md)) and grows with the content. Drag a corner
handle to resize it, as in the component editor.

## Add a view

1. At the bottom of the **Pages** list, click **+ Add Page**.
2. Type the route slug, such as `about-us`, and press Enter.

In a Next.js or Scamp framework project, this creates the view
`views/AboutUs/` and, in Next.js, the wrapper page at `app/about-us/`.
Legacy projects keep creating plain pages.

## Convert a page to a view

1. In the **Pages** list, right-click a page and select **Convert to
   view…**.
2. Click **Convert to view**.

Scamp takes a [snapshot](snapshots.md) first, moves the page's elements
to `views/[Name]/`, and rewrites the page file as a wrapper that
renders the view. The page keeps its route, and the preview still opens
it at the same address.

## Rename or delete a view

Right-click a view in the **Pages** list:

- **Rename…** changes the route slug and the view name together, and
  moves the wrapper page in a Next.js project.
- **Delete…** removes `views/[Name]/` and the wrapper page.

## Bind data in the Data tab

With a view open, the properties panel's **Data** tab lists everything
in the view that can vary with real data. Each row turns a literal on
the canvas into a prop, and the literal becomes the prop's sample
value, which is what the canvas renders and what the generated file
uses as the default.

| Section | What it binds |
|---|---|
| **Text** | A text element as a `string` prop. **Prop** makes it dynamic and **Locked** hardcodes it, as in a component. |
| **Repeat** | An element that renders once per row of a list. Set the list name, the row variable, and the key field, and edit the sample rows as a table. Click **+ field** to add a column and **+ row** to add a row. |
| **Show** | An element that renders only when a flag is true. Set the flag's name and its sample value. |
| **Attributes** | An attribute such as `href`, `src`, or `disabled` as a prop. Boolean attributes gain an **inverted** checkbox, so `disabled` can bind to `!canStart`. |
| **Events** | A handler prop on a button, link, input, or form: `onClick`, `onChange`, or `onSubmit`. |

To start a repeat or a show, right-click an element on the canvas and
select **Repeat this…** or **Show only when…**. The Data tab gains the
row, with a list of one sample row or a flag set to true. Right-click
again and select **Stop repeating** or **Always show** to remove it.

Inside a repeated element, a text prop or a bound attribute can read a
field of the row instead of a prop of its own: type `item.label` as the
name. The rows in the Repeat section are the sample data for every
field.

Every prop is optional in the generated file, with the sample as its
default, so the view renders on its own with no data at all. See
[Code output](code-output.md#views-and-components) for the generated
shape.

## Preview a view

In a Next.js project, **Preview** opens the view at its page's route
through the wrapper page. See [Preview mode](preview.md).

In a Scamp framework project, **Preview** starts the framework's dev
server (`scamp dev`) and opens the view at `/_views/[Name]`, rendered
with its sample data. The page list in the preview window lists the
project's views by slug. The project needs `scampjs` 0.1 or later
installed; the first preview runs `npm install` if `node_modules` is
missing.

## Scamp framework projects

A project that has a `views/` folder and depends on the `scampjs`
package is a Scamp framework project. Scamp opens it with a few
differences from a Next.js project:

- Design tokens live in `design/theme.css`, and the design document in
  `design/DESIGN.md`.
- There are no pages, only views. **+ Add Page** creates a view.
- `routes/` belongs to you. Scamp never reads, lists, or regenerates
  the files in it, but [snapshots](snapshots.md) include them.
- Assets go under `public/assets/`, as in Next.js projects.

When you open the project, Scamp reads the installed `scampjs` version
and the file format it implements. This version of Scamp reads and
writes contracts 0 and 1. If `scampjs` isn't installed, or it
implements a newer or older format, a banner across the top of the
window says which, and asks you to update Scamp or install a matching
`scampjs` before editing. The canvas still opens, but a save would
write files in the shape this version knows. A file keeps the contract
version it declares; new files get the newest.

New projects are Scamp framework projects. To move an existing Next.js
project, see [Migrate a Next.js project](#migrate-a-nextjs-project).

## Migrate a Next.js project

A project in the Next.js layout shows a banner above the canvas. To
migrate it:

1. In the banner, click **Migrate to the Scamp framework**.
2. Click **Migrate**.

Scamp takes a [snapshot](snapshots.md), turns each page into a view
with a route that renders it, moves `theme.css` and `DESIGN.md` under
`design/`, and swaps Next.js for `scampjs` in `package.json`. The
Next.js files move to a `.scamp-backup-` folder inside the project, at
their original paths. Files Scamp didn't write, such as API routes
under `app/api/` or a `features/` folder, stay where they are, and the
app log lists them. A page's markup is unchanged inside its view, so
the canvas looks the same when the project reopens.

Run `npm install` in the project folder before the first preview. To
keep using Next.js instead, click **Dismiss**; the banner stays hidden
for that project.

## Work with agents

`agent.md` explains views to an [AI agent](ai-agents.md): the file
shape, the five binding kinds and how each is written, and the rule
that data is computed in the route and bound in the view. The MCP
server's `scamp_get_view_props` tool returns a view's exact props type
and sample data, so an agent writing the route passes the right shape.
Ask the agent to "write the route for the lobby view" and it has what
it needs.
