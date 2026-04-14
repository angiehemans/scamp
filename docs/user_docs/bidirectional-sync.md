# Bidirectional Sync

Scamp's defining feature is two-way sync between the canvas and your code files. Edit in Scamp and the files update. Edit the files externally and the canvas updates.

## How It Works

Scamp watches your project files using chokidar (a file system watcher). When a `.tsx` or `.module.css` file changes on disk, Scamp:

1. Detects the change.
2. Parses the updated file.
3. Updates the canvas to reflect the new state.

This happens automatically -- no manual refresh needed.

## Editing Externally

Open your project files in any editor:

- **VS Code** -- Edit TSX or CSS and save. The canvas updates within moments.
- **Terminal** -- Use sed, awk, or any CLI tool to modify files.
- **AI Agents** -- Point an agent at your project folder and let it write code. Scamp picks up the changes.

## The agent.md File

Each project includes an `agent.md` file. This file explains the project structure and conventions to AI coding agents. Share it with your agent so it understands which files to edit and how Scamp expects them to be formatted.

## Working with AI Agents

1. Open Scamp and your AI agent side by side.
2. Design the layout in Scamp -- the agent can read the generated files.
3. Ask the agent to add styles, logic, or refine the CSS -- Scamp reloads automatically.
4. Continue iterating between visual design and code.

## Limitations

- [Undo history](undo-redo.md) clears when an external edit is detected.
- Very rapid external writes may briefly show intermediate states.
