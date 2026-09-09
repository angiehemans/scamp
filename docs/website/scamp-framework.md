<!--
Website copy for the Scamp Framework homepage. Drawn from
docs/plans/scamp-framework-plan.md. Everything here describes the
framework as planned; nothing is published yet, so keep the "Status"
section until the first release. Section headings map to homepage
sections; the body text is the copy.
-->

# The Scamp Framework

## Hero

**Design in one file. Style in another. Think in a third.**

The Scamp Framework is a small set of opinions on top of Preact, Vite,
and Hono. It keeps a page's structure, styles, and logic in three files
with one owner each, so a designer, a developer, and a coding agent can
work on the same screen without stepping on each other.

```bash
npm create scamp
```

Three kilobytes of runtime. A build you can read in an afternoon. Files
that still work if you leave.

## What is the Scamp Framework?

It isn't a new runtime. Preact already renders components in 3 kB and
runs most of the React ecosystem through `preact/compat`. It isn't a new
bundler. Vite already starts in under a second. It isn't a new server.
Hono already runs the same handler on Cloudflare, Node, Bun, Deno, and
Vercel.

What the web still lacks is a convention for *who owns what* in a page.
Every framework lets you put markup, styles, data loading, and event
handling in one file, and most encourage it. That's convenient for one
person at one moment. It's the reason a design tool can't write your
pages, an agent rewrites your styles when you asked for a bug fix, and
a redesign means touching the file that holds your business logic.

The Scamp Framework is a handful of opinions that fix that, and the
tooling to make them the path of least resistance. Here they are, with
what each one buys you.

## The opinions

### 1. Structure, styles, and logic live in separate files, and each file has one owner

A screen is three files:

| File | Holds | Owner |
|---|---|---|
| `views/Feed/Feed.tsx` | Markup. A plain JSX function whose only inputs are props. | The design (Scamp, or you by hand) |
| `views/Feed/Feed.module.css` | Styles. A CSS module, one block per element. | The design |
| `routes/index.tsx` | Logic. Loads data, holds handlers, renders the view. | You |

**Why it matters.** The ownership boundary is a file boundary, so a tool
can regenerate a view forever without touching a line of your logic, and
you can rewrite your logic without touching the design. A redesign is a
new view with the same props. A backend change is a new route file with
the same view. Nobody merges around anybody.

### 2. A view's defaults are its sample data

```tsx
// views/Feed/Feed.tsx
import styles from './Feed.module.css';
import Avatar from '@/components/Avatar/Avatar';

type FeedProps = {
  title?: string;
  posts?: Array<{ id: string; author: string; handle: string; body: string; likes: string; time: string }>;
  onLike?: (id: string) => void;
  onReply?: (id: string) => void;
  className?: string;
};

export default function Feed({
  title = "For you",
  posts = [
    { id: "1", author: "Maya Chen", handle: "@maya", body: "Shipped the new onboarding flow today. Three screens, zero modals.", likes: "42", time: "2h" },
    { id: "2", author: "Dev Okafor", handle: "@dev", body: "Hot take: your design system is only as good as its worst default.", likes: "128", time: "5h" },
    { id: "3", author: "Sam Rivera", handle: "@sam", body: "Coffee, then a redesign of the settings page. In that order.", likes: "9", time: "8h" },
  ],
  onLike,
  onReply,
  className,
}: FeedProps) {
  return (
    <main data-scamp-id="root" className={`${styles.root} ${className ?? ''}`}>
      <header data-scamp-id="feed_header_a1b2" className={styles.feed_header_a1b2}>
        <h1 data-scamp-id="feed_title_a1b3" className={styles.feed_title_a1b3}>{title}</h1>
      </header>

      <section data-scamp-id="post_list_c3d4" className={styles.post_list_c3d4}>
        {posts.map((post) => (
          <article data-scamp-id="post_card_c3d5" className={styles.post_card_c3d5} key={post.id}>
            <Avatar data-scamp-instance-id="inst_9f21" name={post.author} />
            <div data-scamp-id="post_body_c3d6" className={styles.post_body_c3d6}>
              <div data-scamp-id="post_meta_c3d7" className={styles.post_meta_c3d7}>
                <p data-scamp-id="post_author_c3d8" className={styles.post_author_c3d8}>{post.author}</p>
                <p data-scamp-id="post_handle_c3d9" className={styles.post_handle_c3d9}>{post.handle}</p>
                <p data-scamp-id="post_time_c3da" className={styles.post_time_c3da}>{post.time}</p>
              </div>
              <p data-scamp-id="post_text_c3db" className={styles.post_text_c3db}>{post.body}</p>
              <div data-scamp-id="post_actions_c3dc" className={styles.post_actions_c3dc}>
                <button data-scamp-id="like_button_c3dd" className={styles.like_button_c3dd} type="button" onClick={() => onLike?.(post.id)}>
                  Like · {post.likes}
                </button>
                <button data-scamp-id="reply_button_c3de" className={styles.reply_button_c3de} type="button" onClick={() => onReply?.(post.id)}>
                  Reply
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
```

Read it top to bottom: a props type, the defaults, and markup that only
binds. The list repeats one card per post, each text element binds a
field, and the buttons call handler props that default to nothing. The
matching `Feed.module.css` holds one block per `data-scamp-id`, and
nothing else in the file knows where the posts come from.

Every prop has a default, and the default is what the view looks like
with nothing passed in: three posts, a title, and buttons that do
nothing yet. There's no hidden fixtures folder and no
Storybook config. Open the file anywhere and you see what the design
tool sees.

**Why it matters.** A view always renders, so you can preview any screen
in isolation at `/_views/Feed` with zero setup. The props type is
inferred from the samples, so the design defines the data shape and the
backend fills it. Hand a route file to an agent and its job is precise:
replace the sample with a real query.

### 3. Compute in logic, bind in the view

Views bind props. They don't format dates, do arithmetic, or branch on
anything more than a boolean. "2h" and "128" are computed in the route
file and arrive as strings; the view never sees a timestamp or a count.

**Why it matters.** A view with no logic in it is a view any tool can
render, diff, and regenerate, and any person can read in one pass. The
expressive ceiling is deliberate. When you need more, you have the
whole of JavaScript one file over.

### 4. Routes are yours. The framework never generates them

`routes/` is file-based routing with `[param]`, `[...rest]`, and
`(group)` segments. A route file exports a component and an optional
`load()`. That's the whole contract. No layout file you can't touch, no
`page.tsx` that has to be the route, no server-component boundary
deciding where `'use client'` goes.

`load()` gets three things: `params`, the standard `request`, and
`env`, which is where your database binding or connection string
arrives on every deploy target. It imports nothing from the framework's
server.

```tsx
export async function load({ env }: LoadContext) {
  return { posts: await latestPosts(env, { limit: 20 }) };
}

export default function FeedRoute({ data }: RouteProps<typeof load>) {
  const { posts, like } = useFeed(data.posts);
  return (
    <Feed
      title="For you"
      posts={posts.map((p) => ({
        id: p.id,
        author: p.author.name,
        handle: `@${p.author.handle}`,
        body: p.body,
        likes: formatCount(p.likeCount),
        time: timeAgo(p.createdAt),
      }))}
      onLike={(id) => like(id)}
      onReply={(id) => navigate(`/post/${id}`)}
    />
  );
}
```

**Why it matters.** Interactivity is hooks. Data loading is one
function. You can hold the entire model in your head, and so can an
agent, which means the code it writes lands inside your project's shape
instead of beside it.

### 5. Rendering is a property of the route, not the app

```ts
export const render = 'static';   // prerender at build, ship HTML + CSS
export const render = 'server';   // render per request through Hono
export const render = 'client';   // ship the JS, render in the browser
```

One line per route, default `static`. The same `Feed` view can be
prerendered for a public profile page and client-rendered for the
signed-in home timeline.

**Why it matters.** You stop choosing a framework by its rendering
strategy. A landing page, a public profile, and a live timeline live in
one project, each rendered the way it should be.

### 6. Islands come from the data, not from you

The framework knows which views declare event props, so it knows which
views need JavaScript at all. A static route whose views have no events
ships zero JavaScript. A route with one interactive view hydrates only
that view.

**Why it matters.** You get Astro-style islands without marking them.
A site built this way is lighter than the same site in a full-page
framework by default, and nobody had to think about it.

### 7. One server surface, and you rarely have to touch it

Under the hood, loaders and API routes run on Hono. Your code doesn't
have to know that. An API route is a plain function over the standard
`Request` and `Response`, one file each under `routes/api/`:

```ts
// routes/api/posts/[id]/like.ts
export const POST = async ({ params, env }: LoadContext<{ id: string }>) => {
  return Response.json({ likeCount: await likePost(env.DB, params.id) });
};
```

When you want routing inside a file, middleware for sessions, auth,
CORS, or validation, or a typed client for your own API, export a Hono
app from the same file instead. That's the opt-in, not the default.

**Why it matters.** A static site never runs a server at all. An app
that needs one gets code that runs unchanged on Cloudflare Workers,
Node, Bun, Deno, and Vercel, because Hono already did that work. Your
backend is real, typed, and portable from day one, and it never imports
a framework.

### 8. Bring your own database. We'll set up Drizzle

The framework bundles no ORM and no driver. It asks one optional
question when you create a project: SQLite, Postgres, Cloudflare D1, or
none. Pick one and you get a Drizzle schema file, a `db(env)` helper
that works in dev and on every adapter, migration scripts, a typed
`env`, and a section in `agent.md` that teaches the whole thing to a
coding agent. Add it later with `scamp add drizzle`.

```tsx
export async function load({ env }: LoadContext) {
  const rows = await db(env).query.posts.findMany({ limit: 20 });
  return { posts: rows };
}
```

**Why it matters.** Full-stack shouldn't mean picking an ORM before
you've drawn a screen, and it shouldn't mean the framework picking one
for you forever. One well-paved path, one command, and the view's props
stay separate from the schema, so a redesign never touches a migration.

### 9. The files are the product

A view is a plain JSX function with a CSS module. `preact/compat` renders
it under React unchanged. `views/`, `components/`, and `design/theme.css`
drop into a Next, Remix, or Vite project exactly as they are.

**Why it matters.** This is the answer to lock-in. Use the framework
because it's the fastest way to run these files, not because you have
to. If a project outgrows it, take the files and go.

### 10. Small enough to read in an afternoon

The framework is conventions and tooling: a Vite plugin, a router, a
CLI, and a few hundred lines of runtime helpers. Anything that grows
past that is a sign we're rebuilding a runtime or a platform, and
becomes an adapter to an existing one instead.

**Why it matters.** You can audit it. You can fix it. You can explain
the whole thing to a new teammate before lunch.

## Why Preact

A runtime is a multi-year quality bar, and the space already has mature,
tiny, MIT-licensed incumbents. Preact is 3 kB, ships hooks, hydrates
islands, and runs most React libraries through `preact/compat`. None of
the framework's value lives in the runtime, so it doesn't own one.

If a library assumes React proper, the runtime is a config line. Swap
it.

## What it's built on

| Layer | Choice | What the framework adds |
|---|---|---|
| Runtime | Preact | Nothing. That's the point. |
| Dev server and build | Vite | File-based routing, `load()`, the `@/` alias, theme injection, the `/_views` preview route |
| Server | Hono | Loaders, API routes, SSR, and deploy adapters on one `Request → Response` surface |
| CLI | `scamp` | `dev`, `build`, `preview` |

## The project layout

```
my-project/
  views/          ← structure + styles, one folder per screen
  components/     ← reusable pieces, same shape as views
  routes/         ← your logic; file-based routing; API routes under api/
  db/             ← optional: your Drizzle schema
  design/         ← theme.css tokens and fonts, DESIGN.md
  package.json    ← "dev": "scamp dev", "build": "scamp build"
```

## Built for the tools you actually use

**Scamp, the design tool.** Draw a screen, and Scamp writes the view and
its CSS module, with the props and sample data you chose in its Data
tab. The framework's dev server is Scamp's preview. You never need
Scamp to use the framework, and you never need the framework to keep
using files Scamp wrote.

**Coding agents.** Every project ships an `agent.md` that explains the
three-file contract, the binding grammar, which files are regenerated
and which are yours, and the rule that views bind and routes compute.
An agent working in a Scamp Framework project writes route files
against views that already have props, instead of copying markup into
a screen of its own.

**Your editor.** It's JSX, CSS modules, and TypeScript. Every tool you
have already works.

## Deploy anywhere

Static hosting first. Then Cloudflare Workers and Pages, Node, Vercel,
and Netlify, as thin adapters on Hono. A static route with no events is
HTML and CSS, so the simplest deploy is copying a folder.

## Get started

```bash
npm create scamp
cd my-project
npm run dev
```

| Command | Does |
|---|---|
| `scamp dev` | Vite dev server with routing, loaders, and API routes. Any view previews at `/_views/<Name>`, such as `/_views/Feed`. |
| `scamp build` | Prerenders static routes, bundles server routes into the Hono app, ships client routes as an SPA entry. |
| `scamp preview` | Serves the build the way an adapter would. |
| `scamp add drizzle` | Adds a database to a project that started without one. |

## Questions people ask

**Do I need Scamp to use this?**
No. `npm create scamp` scaffolds a project with no design tool involved.
Write views by hand if you like; the conventions are the value. Open the
project in Scamp later, or never.

**Can I use React libraries?**
Most of them, through `preact/compat`. If one assumes React proper,
switch the runtime in config.

**Do I have to use Hono?**
No. A static site never runs it. Loaders and API routes are plain
functions over `Request`, `Response`, and an `env` object. Export a
Hono app from an API file only when you want its routing, middleware,
or typed client.

**How do I add a database?**
Choose one when you create the project, or run `scamp add drizzle`
later. You get a Drizzle schema, a typed `db(env)` helper, migration
scripts, and agent documentation. Nothing about the database is
bundled into the framework itself.

**Can I keep my Next.js backend?**
Yes. Views and components are plain JSX and CSS modules. Import them
into a Next project and write Next route files against them.

**Is the sample data shipped to production?**
Yes. Defaults live in the file, so a view rendered without props shows
its samples. That's what makes every view previewable with no setup.
Pass real props and the samples are never seen.

**Where's the escape hatch?**
The route file, which is all of JavaScript, or a hand-written component
in `components/`. Views stay simple on purpose.

**What's the license?**
MIT. The framework ends up inside your shipped app, so it has to be.

## Status

The Scamp Framework is in development. The conventions are settled and
documented; the package isn't published yet. Follow the repository for
the first release, and read the design plan if you want the reasoning
in full.
