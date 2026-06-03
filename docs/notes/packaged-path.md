# Packaged-app PATH resolution (macOS / Linux GUI launch)

## Symptom

In a packaged build, opening a project and clicking **Preview** fails with:

```
Dev server crashed (exit -1)
Failed to spawn next dev: spawn npm ENOENT
```

"Restart server" does not help. The same project previews fine when the
app is run via `npm run dev` from a terminal.

## Cause

When an Electron app is launched from Finder / Dock / Spotlight (i.e. by
`launchd`, not a shell), it inherits a **minimal** `PATH` —
`/usr/bin:/bin:/usr/sbin:/sbin`. It does **not** inherit the login
shell's `PATH`. The user's `node` / `npm` live somewhere that minimal
PATH never includes:

- Homebrew: `/opt/homebrew/bin` (Apple Silicon) or `/usr/local/bin` (Intel)
- nvm: `~/.nvm/versions/node/<ver>/bin` (only added by an *interactive* shell)
- Volta / asdf / fnm: similar per-user shim dirs

So `child_process.spawn('npm', …)` throws `ENOENT` — npm is genuinely not
on the process's PATH. This hits every spawn: `npm install`, `next dev`,
and the node-pty terminals.

Running from a terminal works because the terminal already exported the
full PATH into the environment the app inherited.

## Fix

`src/main/fixPath.ts` runs once at main-process startup (before any
spawn). It executes the user's login+interactive shell
(`$SHELL -ilc …`) to print the *real* resolved `PATH`, then merges it
into `process.env.PATH`. `-i` is required so interactive-only rc files
(where nvm/fnm typically live) are sourced; `-l` covers `.zprofile` /
`.bash_profile`. A delimiter brackets the value so shell prompt/banner
noise can't corrupt it.

It is a no-op on Windows (the `.cmd` shim is resolved via `shell: true`
at the spawn sites) and is only invoked when `app.isPackaged` is true —
in dev the inherited terminal PATH is already correct and we skip the
~100-300ms shell spawn.

If shell resolution fails for any reason, PATH is left untouched; we
never block startup on it.
