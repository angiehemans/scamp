# The Scamp MCP server

Lets an agent in the terminal query the live canvas — what's selected, what
its styles are, what the tree looks like — instead of relying on the user to
describe it, or on a context file that may be a moment stale.

Protocol details: `docs/notes/mcp-protocol.md`.
Decision history: `docs/plans/mcp-server-plan.md`.

## Shape

```
agent ──HTTP──▶ server.ts ──▶ protocol.ts ──▶ tools.ts
                                                  │
                                          pendingQueries.ts
                                                  │ IPC (correlated)
                                                  ▼
                                        mcpResponder.ts (renderer)
                                                  │
                                        canvasSnapshot.ts ──▶ Zustand store
```

`lifecycle.ts` is the **only** file that imports `electron`. That's
deliberate and load-bearing: it's what lets `server.ts`, `protocol.ts`,
`tools.ts`, `pendingQueries.ts`, `mcpOps.ts`, and `agentConfig.ts` be unit
tested without launching an app.

## Pull-through, not a cache

Main holds **no** canvas state. A tool call becomes an IPC round trip to the
renderer, which reads the store at that moment and replies.

The alternative — pushing a debounced snapshot into main — is simpler and
wrong for the one case that matters: the user clicks an element and
immediately asks "make this wider". A cache still holding the previous
selection answers confidently and incorrectly, and nobody can tell. A visible
2s timeout (`isError: "the Scamp canvas did not respond"`) beats a silently
stale answer.

## Third consumer of one model

`canvasSnapshot.ts` renders `contextModel.ts`, the same facts layer behind
`.scamp/context.md` and the copy-context one-liner. Deriving them once is what
stops the context file and the MCP tools describing the same element two
different ways — a drift that would be silent, because nothing compares them.

## Lifecycle

Starts in `startMcpForProject`, called beside `watchProject` in
`ipc/project.ts` — opening a different project moves the server with it, since
every tool answers about whatever is on canvas. Stops in
`performShutdownCleanup`, the one hook that runs reliably on programmatic
quit.

A failed start degrades to "no MCP", never to "the project won't open".

**Port 39841, fixed**, scanning forward 10 on collision. Fixed rather than
ephemeral because the URL lands in the agent's config *file*, which is not
re-read at runtime — a moving port would invalidate every registration on
every restart.

## Auto-registration — the part that writes outside `.scamp/`

`agentConfig.ts` writes our entry into each installed agent's own config, so
the user runs no command. This is the only MCP code that touches files Scamp
doesn't own, and it is the highest-consequence code in the feature.

| Agent | Path | Entry shape |
|---|---|---|
| Claude Code (always) | `.mcp.json` | `{type: 'http', url, headers}` |
| Cursor | `.cursor/mcp.json` | `{url, headers}` |
| Gemini CLI | `.gemini/settings.json` | **`{httpUrl, headers}`** |
| Kiro | `.kiro/settings/mcp.json` | `{url, headers}` |

**Gemini takes `httpUrl`, not `url`.** In Gemini, `url` means an SSE
endpoint — writing it would register our streamable-HTTP server as SSE and
fail at connect time, silently, for Gemini users only. Assume nothing is
uniform across agents; verify each one and add a test.

Rules the merge follows, all tested:

- **Never clobber.** Existing servers and unrelated top-level keys survive.
  Malformed JSON, a JSON array, or a wrong-typed server map → refuse and
  report, leaving the file byte-identical.
- **Only for installed agents**, detected by a home-directory marker.
  Otherwise every project acquires `.cursor/`, `.gemini/`, `.kiro/` for tools
  the user doesn't have. Claude Code is the exception — one file, no
  directory, primary target.
- **Everything written is gitignored.** This cuts against convention
  (`.mcp.json` is normally committed, to share MCP config with a team) because
  ours holds a machine-local URL and a token.

**Not yet supported:** VS Code (`servers` key; the reachable docs describe the
extension-provider API, and `.vscode/mcp.json` permits comments our merge
can't preserve) and Codex (TOML; project-level support unconfirmed). Both are
additive — the terminal copy button covers them meanwhile.

## Approval

A project-scoped server reports `⏸ Pending approval` in Claude Code and **does
not connect** until approved in an interactive session. Not a dialog that
appears while you work — a state it sits in.

Claude Code has settings that could auto-enable it. **Don't.** That's
bypassing a trust control on the user's behalf. The `McpStatusPill` says
approval may be needed instead.

## Gotchas

- Every config path is a **dotfile** path, so `watcher.ts:56` ignores it. A
  non-dotfile target would make Scamp see its own write as an external edit
  and auto-snapshot on every launch.
- The `.js` shims emit **extensionless imports**. electron-vite resolves them;
  bare Node does not — bundle with esbuild first if you want to run one
  directly (useful for testing against a real client).
- `stopMcp` rejects in-flight queries **before** closing the socket, so a
  waiting agent gets a reason rather than a timeout.
- `markMcpStopped` rewrites `running: false` rather than deleting
  `mcp.json` — deleting takes the token with it, and a regenerated token
  invalidates every agent config already holding the old one.
