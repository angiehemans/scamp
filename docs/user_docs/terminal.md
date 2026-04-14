# Terminal

Scamp includes a built-in terminal so you can run commands without leaving the app.

## Opening the Terminal

Press **Ctrl+`** (backtick) to toggle the terminal panel. Press again to hide it.

## Using the Terminal

The terminal opens in your project directory by default. Use it to:

- Run build scripts (`npm run build`)
- Install dependencies (`npm install`)
- Run AI agents or CLI tools
- Execute git commands

## Multiple Tabs

You can open up to **3 terminal tabs**. Each tab runs an independent shell session. Use this to run a dev server in one tab and an agent in another.

## Persistence

The terminal keeps running when the panel is hidden. Hide the panel with Ctrl+` and your processes continue in the background. Reopen the panel to see their output.

## Error Recovery

If a terminal fails to start (for example, due to a shell configuration issue), Scamp will attempt to recover automatically. Close the tab and open a new one if issues persist.
