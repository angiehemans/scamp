# Preview Mode

Open your project in a real browser preview window powered by Next.js. Real React, real CSS Modules, real hot module reload — every transition, animation, hover state, link, and form input behaves exactly as it would in production.

## Opening Preview

Click the **▶ Preview** button in the project toolbar (top-right, between the Terminal toggle and the Save indicator), or press **⌘P** / **Ctrl+P**.

A new window opens at the current page. The first time you preview a project, Scamp runs `npm install` automatically — a one-time setup, usually 30–90 seconds. Subsequent opens reuse `node_modules` and start the dev server in a second or two.

The preview is gated on the **Next.js project format**. Legacy-format projects show the Preview button disabled with a tooltip pointing at the migration banner. See [Bidirectional Sync](bidirectional-sync.md) for the migration flow.

## How It Works

The preview runs a real `next dev` server spawned by Scamp. It points at your project folder — the same files you're editing on the canvas — and serves them at `localhost:<port>`. The preview window embeds that URL in a webview, so what you see is the actual deployed page, not a screenshot or simulation.

This means:

- **HMR (hot module reload)** picks up canvas edits in milliseconds. Edit a button's color in Scamp, see it update in the preview window without reloading.
- **Real interactions** work: hover, focus, click, transitions, animations, links, forms.
- **Your project is a standalone runnable app.** You can `npm run dev` from your terminal outside Scamp and get the same preview.

## The Preview Toolbar

```
[ ← ]  [ → ]  [ ↺ ]  [  http://localhost:3001/about  ]  [ ⧉ ]  [ status ]  [ ⚙ ]  [ Mobile · Tablet · Desktop · Fullscreen · custom ]
```

| Control | What it does |
|---|---|
| **←** / **→** | Navigate browser history (back / forward) |
| **↺** | Reload the page (or restart the dev server if it crashed) |
| URL bar | Read-only display of the current page URL |
| **⧉** | Copy URL to clipboard |
| Status chip | Shows `Idle`, `Installing…`, `Starting…`, `Ready`, or `Crashed` |
| **⚙** | Open browser DevTools attached to the preview |
| Viewport selector | Resize the preview to common widths |

### Viewport Sizes

The viewport selector pins the preview content to a specific width:

- **Mobile** — 390px
- **Tablet** — 768px
- **Desktop** — 1440px
- **Fullscreen** — fills the preview window
- **Custom** — type any pixel value

The preview window itself stays the same size; the viewport sits inside it, centered, simulating that screen size. Useful for verifying responsive [Breakpoints](breakpoints.md) at the exact widths your CSS targets.

## Server Lifecycle

| State | What's happening |
|---|---|
| **Idle** | No server running. The preview hasn't started yet. |
| **Installing…** | First-time `npm install`. A spinner shows install progress. |
| **Starting…** | `next dev` is booting. Usually 2–5 seconds. |
| **Ready** | Server is up. The preview shows the live page. |
| **Crashed** | The dev server exited unexpectedly. The Restart button replaces the reload button — click it to spawn a fresh server. |

One server runs per project at a time. Closing the preview window leaves the server running until the project itself is closed (so reopening preview is instant). Closing the project stops the server.

## External Links

Links inside the preview that navigate within your project (e.g. `<a href="/dashboard">`) work like normal browser navigation — back/forward through the toolbar history. Links to external URLs (`https://...`, `mailto:`, `tel:`) open in your **system browser** rather than inside the preview window. The preview is scoped to your project; external destinations belong elsewhere.

This routing happens automatically — see [Linking Between Pages](linking.md) for how to set up internal and external links.

## DevTools

Click the **⚙** button in the preview toolbar to open Chrome DevTools attached to the preview's webview. Inspect the live DOM, debug network requests, profile performance — everything you'd expect in a browser-side debugger.

## Errors

If your TSX has a syntax error, Next.js's error overlay takes over the preview area with a stack trace pointing at the file and line number. Fix the error in your file or via the [Properties Panel](properties-panel.md), and the preview hot-reloads automatically.

If the dev server fails to start (port collision, broken `package.json`, etc.), the preview shows a Crashed state with the recent log output and a Restart button.

## What's NOT in the Preview

- The canvas's selection chrome and overlays.
- Scamp's panel chrome.
- Mock data substitution (planned — pages will eventually accept a `[page-name].data.json` sibling for design-time content).

## Tips

- **⌘P** opens the preview. **⌘P** with the preview already open focuses the existing window — don't worry about spawning duplicates.
- The preview window remembers its position and size between sessions.
- For the closest match between canvas and preview, make sure your project's `theme.css` has the auto-generated browser reset block — it's what keeps margins and form chrome consistent across the two surfaces. See [Themes](themes.md).
- If the preview is blank but the page has content, check that `--font-sans` and the box-sizing reset are in `theme.css`. Older projects pick these up on next open via auto-migration.
