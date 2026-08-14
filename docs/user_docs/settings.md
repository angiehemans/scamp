# Settings

Scamp has two kinds of settings:

- **App settings** — apply to every project. Change them from the Settings icon on the start screen.
- **Project settings** — per-project, stored in `scamp.config.json` at the project root. Change them from the **Settings** icon in the left sidebar rail while a project is open.

## App Settings

### Default Projects Folder

Choose where Scamp creates new projects. All new projects are stored as subfolders inside this directory. You can change this at any time — existing projects are not moved.

### Privacy

**Send anonymous crash reports and usage counts** — Scamp asks once, on
first launch, and nothing is sent unless you say yes. You can change your
mind here at any time; the change takes effect immediately, with no
restart.

When it's on, Scamp sends crash reports and a once-per-session ping so we
can see how many people use it. What that includes:

- **A random ID generated on your machine**, stored in Scamp's own
  settings. It identifies this installation, not you — it isn't derived
  from your name, email, IP address, hostname, or anything else about
  your computer.
- **No project data.** Your files, page contents, image assets, and
  project names are never sent.

Turning it **Off** stops the sending and **deletes the random ID**. If you
turn it back on later, a brand new ID is generated — there's no way to
reconnect the two.

## Project Settings

### Artboard Background Color

Set the color of the area behind the canvas. This is the background you see when zoomed out or around the edges of your design. It does not affect generated code — it's purely a visual preference for this project's workspace.

### Breakpoints

List of responsive breakpoints used by this project. Default: Desktop (1440), Tablet (768), Mobile (390).

For each breakpoint you can edit:

- **Label** — the name shown in the canvas size control (e.g. "Tablet").
- **Width** — the `max-width` value used in generated `@media` queries.

Add custom breakpoints with the **+ Add breakpoint** button. Delete any breakpoint except Desktop, which is the base and can't be removed.

Scamp keeps breakpoints sorted widest-first so the CSS cascade stays predictable.

See [Breakpoints](breakpoints.md) for the full responsive workflow.

### Fonts

Manage Google Fonts imports for this project. See [Typography](typography.md).

## Tips

- Pick a neutral artboard color that contrasts with your design so element boundaries are easy to see.
- Keep your projects folder somewhere accessible, especially if you plan to use [external editors or AI agents](bidirectional-sync.md).
- Match your project's breakpoints to the ones you actually use in production — the defaults are sensible but you can simplify or extend them.
