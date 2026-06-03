# Bidirectional Sync

Scamp's defining feature is two-way sync between the canvas and your
code files. Edit in Scamp and the files update. Edit the files
externally and the canvas updates.

## How It Works

Scamp watches your project files using chokidar (a filesystem
watcher). When a `.tsx` or `.module.css` file changes on disk,
Scamp:

1. Detects the change.
2. Parses the updated file.
3. Updates the canvas to reflect the new state.

This happens automatically — no manual refresh needed.

## Editing Externally

Open your project files in any editor:

- **VS Code** — Edit TSX or CSS and save. The canvas updates within
  moments.
- **Terminal** — Use sed, awk, or any CLI tool to modify files.
- **AI agents** — Point an agent at your project folder and let it
  write code. Scamp picks up the changes.

## The Save-Status Indicator

A pill in the toolbar shows where the canvas stands relative to disk
at any moment. Most of the time you'll see **Saved**. The other
states surface specific situations — click any of them to open a
small popover with more detail.

| State | What it means |
|---|---|
| **✓ Saved** | Canvas and disk are in sync. |
| **↑ Saving…** | A write is in flight. |
| **● Unsaved** | You just edited; the debounce hasn't fired yet (or another write is queued behind a save). |
| **⚠ Save failed** | The last write errored. Popover surfaces the message and a Retry button. |
| **⏸ Paused** | Scamp has paused saving — either because an external editor is touching project files, an agent is running in the integrated terminal, or you paused manually. The popover explains which one. |
| **⚠ Diverged** | The pause cleared, but the canvas has edits that don't match disk. The popover offers **Save canvas** (write your edits, overwriting disk) or **Discard canvas** (reload from disk, losing your in-memory changes). |
| **↺ Reloaded** | A canvas-driven save hit a write conflict and Scamp adopted disk instead. Your in-flight edit was dropped. |

### Pausing manually

The save indicator's popover always includes a **Pause sync** /
**Resume sync** toggle. Pausing locks Scamp into the Paused state
until you resume — useful when you want to make a big external
edit and don't want Scamp's auto-detection to fight you.

## Agent Coexistence

Scamp watches its integrated terminal for non-shell foreground
processes (`claude`, `aider`, `cursor`, etc.). When one runs in
any open terminal tab, Scamp:

1. Auto-pauses saving (indicator → **Paused** with reason
   "agent in the terminal").
2. Buffers your canvas edits in memory — nothing writes to disk
   until the agent settles.
3. Resumes once the foreground process exits.

This prevents the classic agent-vs-canvas race where Scamp
overwrites the agent's in-progress file edits.

### The quiet window

Every external file change opens a 2.5-second quiet window during
which Scamp absorbs additional writes without re-saving the canvas.
Agents typically write the same file 2–5 times in quick succession
as they iterate; the window keeps Scamp from racing those bursts.

If you make a canvas edit during the quiet window, Scamp queues it
and flushes once the window expires.

### Manual override

If Scamp's auto-detection is wrong — say you're running a build
command in the terminal that Scamp mis-identifies as an agent —
click the indicator and pick **Resume sync**. Saving comes back
on for the rest of the project session.

### Diverged: choose which version wins

If both the canvas AND disk gain conflicting edits during a pause
(you typed in the panel; an agent rewrote the same class block),
the pause clears into **Diverged**. The popover lists the canvas
edits that happened during the pause and offers two choices:

- **Save canvas** — Writes the canvas's state to disk, overwriting
  whatever the agent wrote.
- **Discard canvas** — Reloads from disk, dropping your in-memory
  canvas edits.

There's no automatic merge — Scamp surfaces the conflict for you to
resolve explicitly.

## The agent.md File

Each project includes an `agent.md` file. This file explains the
project structure and conventions to AI coding agents — the
`data-scamp-id` / `className` contract, supported HTML tags, the
`@media (max-width: Npx)` format for [breakpoints](breakpoints.md),
which files Scamp manages and which are agent-editable, and the
spacing-token conventions.

Scamp regenerates `agent.md` on every project open, so updates to
the conventions roll out automatically as Scamp evolves. Don't
hand-edit `agent.md` — your edits get overwritten.

A sibling `CLAUDE.md` exists for Claude Code specifically; it just
imports the full `agent.md` so Claude Code sessions land with the
Scamp guidance already loaded.

## Working with AI Agents

1. Open Scamp and your AI agent side by side (or run the agent in
   Scamp's [Terminal](terminal.md) — auto-pause has your back).
2. Design the layout in Scamp — the agent reads the generated files.
3. Ask the agent to add styles, logic, or refine the CSS — Scamp
   reloads automatically.
4. Continue iterating between visual design and code.

If you and the agent end up touching the same file at the same
time, the Paused / Diverged flow described above keeps you from
clobbering each other.

## Limitations

- Very rapid external writes may briefly show intermediate states
  before the quiet window settles.
- Unknown CSS at-rules (`@media (min-width: …)`, `@supports`)
  round-trip verbatim but aren't reflected on the canvas.
- External-edit history lands in the History panel as a single
  "External edit detected" entry — see
  [Undo, Redo, and History](undo-redo.md) for how to step back
  through agent edits.
