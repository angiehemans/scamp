# Terminal

Scamp includes a built-in terminal so you can run commands without leaving the app.

## Opening the Terminal

Press **Ctrl+`** (backtick) to toggle the terminal panel, or click the
terminal icon on the right of the canvas toolbar. Press again to hide it.

## Using the Terminal

The terminal opens in your project directory by default. Use it to:

- Run AI agents or CLI tools — see [Working with AI Agents](ai-agents.md)
- Execute git commands

## The MCP Indicator

When a project is open, the panel header shows an **MCP** pill with a
green dot — Scamp's [MCP server](ai-agents.md) is running and your agent
can query the live canvas. Its tooltip lists which agent configs Scamp
registered.

The copy button beside it puts a connect command on your clipboard, for
agents Scamp can't configure automatically (VS Code, Codex) or for a
session that was already running when you opened the project.

## Multiple Tabs

You can open up to **3 terminal tabs**. Each tab runs an independent shell session. Use this to run a dev server in one tab and an agent in another.

## Persistence

The terminal keeps running when the panel is hidden. Hide the panel with Ctrl+` and your processes continue in the background. Reopen the panel to see their output.

## Error Recovery

If a terminal fails to start (for example, due to a shell configuration issue), Scamp will attempt to recover automatically. Close the tab and open a new one if issues persist.
