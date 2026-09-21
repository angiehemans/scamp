# Routes in the app

How the app shows and touches `routes/` in a Scamp-framework project
without becoming a backend builder. The framework owns routing
(scampjs CONTRACT.md section 1.5); the app reads, lists, and writes two
small things. The plan is `docs/plans/framework-phase-7-plan.md`.

## What the app reads

`src/main/ipc/routeOps.ts` scans `routes/` with the framework's segment
grammar (`index`, `[param]`, `[...rest]`, `(group)`, the `api/` prefix)
and reads two things from a page route's source: the `render` export
and the view it imports from `views/`. Nothing else is parsed; the file
is the developer's. `readProject` includes the list for scamp-format
projects, `useRoutes` re-lists when the watcher reports a change under
`routes/`, and `scamp_list_routes` answers the same list to an agent
from the main process, since routes are not canvas state.

## What the app writes

- **The `render` export.** The Routes section and its control
  calls `setRouteRender`, which replaces an existing export in place or
  inserts one after the imports. Nothing else in the file changes.
- **A generated route.** `lib/generateRoute.ts` writes
  `routes/<slug>.tsx` for a view no route renders yet: `load()` returns
  the view's sample data, shaped by `collectViewProps`, and the
  component renders the view with it. A view with event props gets
  `render = 'client'` and no-op handlers, since the route must run in
  the browser to call them. With a Drizzle recipe present
  (`lib/db.ts`), a commented query shows the shape of the real one.
  `writeRouteFile` refuses to overwrite: an existing route is the
  user's.

## Where the sections live

With nothing selected, the properties panel is page-level, so it holds
Routes, then the view's Data (`ViewDataSection`, the same rows the Data
tab renders, without the tab's own scroll), then the keyboard shortcuts
as a collapsed reference. All three use the `Section` primitive, so
they read like the element sections below a selection. The mode toggle
is not rendered there: Visual and CSS describe a selected element, and
Data no longer needs a tab to be reachable. `PropertiesPanel` takes the
Routes section as a node rather than reading routes itself, so it stays
about the selection.

The list is scoped to the open page: the routes whose `view` is the
view on the canvas, and Generate route for that view when nothing
renders it yet. The panel it lives in is about the page in front of
you, and three render-mode buttons per route made a project-wide list
unreadable in a sidebar. **A consequence worth knowing:** API routes
and other pages' routes are no longer listed anywhere in the app. An
agent still gets all of them through `scamp_list_routes`.

Each route reads as its path with the render mode on the line beneath
it — side by side, the three mode buttons pushed the path out of a
narrow sidebar.

Opening a route from the list shows it read-only in the code panel
(`routeSource` in the store) in place of the open view's code, with a
way back.

## The dev server's log

`scamp dev` runs with `--json` (contract section 2.1). The manager
turns each request or error line into a readable preview log line and
forwards it over `preview:devLog` to the renderer, which writes it to
the app log as `preview: GET /path 200 12ms`. `parseDevJsonLine` in
`devLog.ts` is the one parser.

## `.dev.vars`

Local values for `env`. The framework's template gitignores it,
snapshots never copy it (they copy pages and components only), and the
renderer only ever sees its keys: Settings lists them under
**Environment** with an **Open** button that opens the file in the
user's editor. The values stay in the main process.

## agent.md

`refreshAgentMdIfNeeded` regenerates the app's template on every open.
A framework project's file may carry sections a recipe appended under
`<!-- scamp:recipe:<name> -->` markers (the Database section from
`scamp add drizzle`); `withRecipeSections` keeps them after the
template, so the app consumes the framework's section instead of
writing its own.
