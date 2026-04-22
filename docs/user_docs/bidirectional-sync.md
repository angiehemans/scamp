# Bidirectional Sync

Scamp's defining feature is two-way sync between the canvas and your code files. Edit in Scamp and the files update. Edit the files externally and the canvas updates.

## How It Works

Scamp watches your project files using chokidar (a file system watcher). When a `.tsx` or `.module.css` file changes on disk, Scamp:

1. Detects the change.
2. Parses the updated file.
3. Updates the canvas to reflect the new state.

This happens automatically — no manual refresh needed.

## Editing Externally

Open your project files in any editor:

- **VS Code** — Edit TSX or CSS and save. The canvas updates within moments.
- **Terminal** — Use sed, awk, or any CLI tool to modify files.
- **AI Agents** — Point an agent at your project folder and let it write code. Scamp picks up the changes.

## Save Confidence

A save-status indicator lives in the toolbar and shows one of four states at any moment:

- **✓ Saved** — Canvas and disk are in sync.
- **↑ Saving…** — A write is in flight.
- **● Unsaved** — You just edited; the debounce hasn't fired yet.
- **⚠ Save failed** — The last write errored. A Retry button appears next to the indicator; errors also log to the App Log tab in the terminal panel.

Most of the time you'll see **Saved** — writes succeed silently in a couple of hundred milliseconds. If you see a persistent **Unsaved** or **Save failed**, your project folder may have permission issues or be on a read-only drive.

## The agent.md File

Each project includes an `agent.md` file. This file explains the project structure and conventions to AI coding agents. Share it with your agent so it understands which files to edit and how Scamp expects them to be formatted.

The `agent.md` covers:

- The `data-scamp-id` / `className` contract.
- Supported HTML tags and tag-specific attributes.
- The `@media (max-width: Npx)` format for [breakpoints](breakpoints.md).
- What NOT to touch (theme.css ordering, scamp.config.json).

## Working with AI Agents

1. Open Scamp and your AI agent side by side.
2. Design the layout in Scamp — the agent can read the generated files.
3. Ask the agent to add styles, logic, or refine the CSS — Scamp reloads automatically.
4. Continue iterating between visual design and code.

## Limitations

- [Undo history](undo-redo.md) clears when an external edit is detected.
- Very rapid external writes may briefly show intermediate states.
- Unknown CSS at-rules (`@media (min-width: …)`, `@keyframes`, `@supports`) round-trip verbatim but aren't reflected on the canvas.
