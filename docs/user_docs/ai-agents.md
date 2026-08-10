# Working with AI Agents

Scamp gives coding agents three ways to understand what's on your
canvas, so you don't have to describe it. All three work with any
agent that can read your project folder; the MCP server additionally
needs an agent that speaks MCP (Claude Code, Cursor, Gemini CLI, Kiro
and others).

If you're looking for how Scamp and an agent avoid overwriting each
other's file edits, that's [Bidirectional Sync](bidirectional-sync.md).

## The MCP Server

While Scamp is open with a project, it runs a small local server that
lets an agent **query the live canvas** — what's selected right now,
what styles it has, what the page structure looks like.

This is the best of the three: the answers are read at the moment the
agent asks, so they're never stale.

### Setup: there isn't any

Scamp registers the server in each installed agent's own config when
you open a project. You don't run a command.

| Agent | File Scamp writes |
|---|---|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Gemini CLI | `.gemini/settings.json` |
| Kiro | `.kiro/settings/mcp.json` |

Only agents you actually have installed get a file — Scamp checks for
each one's config folder in your home directory first. Existing
servers in those files are left alone; Scamp only adds its own entry.

VS Code and Codex aren't configured automatically yet. For those, use
the **copy button** on the terminal's MCP indicator (see below) to get
a ready-to-paste connect command.

### One approval, the first time

Most agents won't trust a project-level server until you say so.
In Claude Code it shows as **⏸ Pending approval** until you run
`claude` once and approve it.

This is a security prompt, not a bug — it's you consenting to a local
server reading your project. Scamp deliberately doesn't bypass it.

### What the agent can ask

| Tool | Answers |
|---|---|
| `scamp_get_selected_element` | Everything about what's selected — class, tag, parent, children, styles |
| `scamp_get_element_by_id` | The same, for any element by id |
| `scamp_get_element_tree` | The page structure — ids, tags, classes, no styles |
| `scamp_get_active_page` | Which page or component is open, and its file paths |
| `scamp_list_pages` | Every page in the project |
| `scamp_list_components` | Every [component](components.md) and its files |
| `scamp_get_theme_tokens` | Your [design tokens](design-tokens.md), so the agent uses a token instead of a raw hex |
| `scamp_get_canvas_state` | A broad snapshot — large, and capped |

In practice you just talk normally. Select a button, then type *"make
this wider"* — the agent calls `scamp_get_selected_element` and knows
what "this" is.

### Where the connection details live

`.scamp/mcp.json` inside your project holds the server's URL and an
access token. Scamp adds every file it writes to your `.gitignore`:
the token is specific to your machine, so committing it would leak it
and give your teammates a dead address.

The server starts when you open a project and stops when Scamp quits.

## The Context File

Scamp keeps `.scamp/context.md` up to date with whatever is selected —
the open page or component, the element's class and tag, its current
styles, its children, and its ancestor chain.

It's a snapshot written on each selection, so it's a good fallback
when Scamp is closed or the agent doesn't support MCP. When both are
available, the MCP tools are better: they read the canvas at the
moment of asking, whereas the file reflects your last interaction.

`agent.md` tells agents to read it, so most will pick it up without
being asked. Don't edit it — Scamp rewrites it constantly.

## Copy Context

Sometimes you just want to paste a description into a prompt.

**Right-click an element on the canvas → Copy context for agent**, or
press **Cmd/Ctrl+Shift+C**. You get one line on your clipboard:

```
Context: app/page.tsx → .rect_a1b2 (div, flex row, gap 16px, 400×300px).
2 children: .rect_c3d4 (div), .text_e5f6 (p "Sign up"). Full styles in
app/page.module.css.
```

Paste it in front of your question and the agent knows exactly which
element you mean.

Right-clicking always selects the element first, so the copied text
always matches what the properties panel is showing. With **nothing**
selected, the keyboard shortcut copies a page-level summary instead —
useful when you're asking about the whole layout.

## Which One Should I Use?

| Situation | Use |
|---|---|
| Agent supports MCP, Scamp is open | **MCP tools** — always current |
| Agent can't do MCP, or Scamp is closed | **Context file** |
| You're writing a prompt by hand | **Copy context** |

## Is It Working?

Open the [Terminal](terminal.md) panel. When the server is running you'll
see an **MCP** indicator in the panel header with a green dot. Its
tooltip lists which agent configs Scamp registered.

If the indicator is absent, no project is open or the server didn't
start. If it's present but your agent has no `scamp_*` tools, you
most likely still need to approve the server in that agent.

## Related

- [Bidirectional Sync](bidirectional-sync.md) — how Scamp and an agent
  share files without clobbering each other
- [DESIGN.md](design-md.md) — the design-system document agents read
  for tokens and usage guidance
- [Terminal](terminal.md) — running an agent inside Scamp
