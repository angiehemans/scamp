# The Scamp framework

Every new Scamp project runs on the Scamp framework, a small framework
built for the way Scamp works: a page is a design file you edit on the
canvas and a logic file you or an agent write in code, and neither one
overwrites the other.

You don't have to learn it to use Scamp. Draw pages, and Scamp writes
the files. This page explains what those files are, so that when you
open the folder, ask an agent for a feature, or hand the project to a
developer, the layout makes sense.

## What's in a project

```
my-project/
├── views/Home/Home.tsx          What the page looks like
├── views/Home/Home.module.css   Its styles
├── routes/index.tsx             What the page knows, and its address
├── components/Card/             Reusable pieces, in the same shape
├── design/theme.css             Your design tokens
├── public/assets/               Images you import
├── agent.md                     Instructions for AI agents
└── package.json
```

A page is three files with one owner each:

- **The view** is its structure and its styles. Scamp owns both and
  rewrites them as you design. See [Views](views.md).
- **The route** is its logic: the data the page needs, and the address
  it lives at. It's yours. Scamp lists routes and can write a starter,
  but never rewrites one. See [Routes](views.md#routes).

## What Scamp writes, and what's yours

| Files | Who owns them |
| --- | --- |
| `views/`, `components/` | Scamp writes and rewrites them |
| `design/theme.css` | Scamp writes it from the [Design System panel](design-system.md); you can edit it directly |
| `routes/` | Yours. Scamp lists them, sets one line, and can generate a starter |
| `lib/`, `db/`, `.dev.vars` | Yours. Scamp never touches them |
| `agent.md` | Scamp refreshes it when you open the project |
| `.scamp/`, `scamp.config.json` | Scamp's own state |

Editing a file Scamp owns is fine. The canvas reloads when you save,
the same as any [external edit](bidirectional-sync.md).

## Your design is the contract

When you mark something in the [Data section](views.md#bind-data-in-the-data-tab),
such as a text prop, a list to repeat, or a button's click handler,
Scamp writes it into the view as a typed property with your canvas
content as its sample value. The view renders that sample whenever
nothing supplies real data, which is why a design looks right before
any data exists.

That list of properties is also the shape a route has to provide. So
the design defines the data, and the backend fills it in. **Generate
route** writes a route whose loader returns your sample data, already
typed, and an agent's job is to replace the samples with a real query.

## Preview, build, and deploy

**Preview** runs the framework's dev server and opens your project in a
browser window. The first preview installs the project's dependencies,
which takes a few seconds. See [Preview mode](preview.md).

Building and deploying happen in a terminal, either yours or the
[built-in one](terminal.md):

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the dev server, the same one **Preview** uses |
| `npm run build` | Writes the site to `dist/` |
| `npm run preview` | Serves `dist/` the way a host would |

`npm run build` produces a folder any static host serves. Pages that
need a server, such as anything reading a database per request, need a
deploy adapter, which the framework's own documentation covers.

## Work with agents

`agent.md` in the project root tells an AI agent the file shapes, the
rule that data is computed in the route and bound in the view, and
where the routes live. Combined with Scamp's
[MCP server](ai-agents.md), an agent can see a view's exact property
types and every route in the project, so a request like "write the
route for the lobby page" has everything it needs.

If you add a database with the framework's `scamp add drizzle`, the
instructions that command adds to `agent.md` survive Scamp's own
updates to the file.

## Framework documentation

The framework is a separate open-source project,
[`scampjs`](https://github.com/scampdesign/scampjs). Its documentation
covers routing, loading data, rendering modes, API routes, databases,
and deployment, and is the right reference for anyone writing the
`routes/` side of a project.

## If a project isn't on the framework

Projects created before the framework use the Next.js layout, with
pages under `app/`. They keep working exactly as they did, and Scamp
offers a one-click move whenever you're ready. See
[Migrate a Next.js project](views.md#migrate-a-nextjs-project).
