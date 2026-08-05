# Scamp — AI Feature Backlog
## Agent Context and Integration

Three stories that progressively improve how coding agents running in
the Scamp terminal understand the current canvas state. Each story
builds on the last and can be shipped independently.

**Core principle:** Agents working on a Scamp project should always
know which page is open, which element is selected, and what its
current styles are — without the user having to describe it manually
in every prompt.

---

## 1. Live context file (.scamp/context.md)

**User story**

As a user running a coding agent in the Scamp terminal, I want the
agent to always have access to the currently open page and selected
element without me having to describe them manually, so I can ask
direct questions like "why does this element look wrong" and the
agent already has the context it needs.

**Behaviour**

Scamp writes a `.scamp/context.md` file inside the project folder
whenever the active page changes or the selected element changes.
The file is always current — it reflects the canvas state at the
moment of reading.

The file is updated:
- When the user switches pages
- When the user selects a different element
- When the selected element's styles change (debounced 500ms)
- When the user deselects everything (shows "No element selected")

**File format:**

```markdown
# Scamp Active Context

> This file is updated automatically by Scamp. Do not edit.
> It reflects the current canvas state as of the last interaction.

## Active page

File: app/dashboard/page.tsx
CSS:  app/dashboard/page.module.css

## Selected element

ID:      a1b2
Class:   .rect_a1b2
Tag:     div
Name:    sidebar (user-defined name, if set)
Parent:  .root

## Current styles

display: flex;
flex-direction: row;
gap: 16px;
padding: 24px;
background: #f0f0f0;
border-radius: 8px;
width: 400px;
height: 300px;

## Children

- .rect_c3d4 (div) — 2 children
- .text_e5f6 (p)   — "Hello world"

## Custom properties (not mapped to canvas controls)

box-shadow: 0 2px 8px rgba(0,0,0,0.1);

## Canvas size

1440px wide / desktop breakpoint
```

When no element is selected:

```markdown
# Scamp Active Context

> This file is updated automatically by Scamp. Do not edit.

## Active page

File: app/dashboard/page.tsx
CSS:  app/dashboard/page.module.css

## Selected element

None selected.
```

**agent.md addition**

The auto-generated `agent.md` is updated to include a reference to
the context file so agents read it automatically without the user
having to mention it:

```markdown
## Active context

Scamp maintains a live context file at `.scamp/context.md`.
This file always reflects the currently open page and selected
element. Read it at the start of every session and refer to it
when the user asks about a specific element or style.
```

**File location and gitignore**

`.scamp/context.md` lives alongside `.scamp/snapshots/` inside the
`.scamp/` folder which is already gitignored. It is a runtime file,
not a project file — never committed to version control.

**Implementation notes**

- Context file writes are triggered by Zustand state changes in the
  renderer — the same subscription that drives the canvas re-render
  also triggers a debounced `file:writeContext` IPC call
- The main process writes the file via the existing file write
  infrastructure — no new IPC channels needed beyond `file:writeContext`
- The write is fire-and-forget — never block the canvas update
  waiting for the file write to complete
- If the write fails (disk full, permissions) log silently and
  continue — a failed context write is never worth surfacing to the
  user

**Done when:** Selecting an element in Scamp causes `.scamp/context.md`
to update within 500ms with the correct element details. An agent
that reads the file can reference the correct class name, tag, and
styles without the user typing them.

---

## 2. Copy context button

**User story**

As a user about to ask an agent a question about a specific element,
I want to copy a rich, pre-formatted context string to my clipboard
with one click so I can paste it into the terminal and immediately
ask my question without typing out element details manually.

**Behaviour**

A small "Copy context" icon button appears in the canvas toolbar,
next to the existing tools. It is only active when an element is
selected — when nothing is selected it is dimmed.

Clicking the button copies a context string to the system clipboard
and shows a brief "Copied" confirmation on the button.

**Copied string format:**

```
Context: dashboard/page.tsx → .rect_a1b2 (div, flex row, gap 16px,
padding 24px, 400×300px, background #f0f0f0). 2 children: .rect_c3d4
(div), .text_e5f6 (p "Hello world"). Full styles in
app/dashboard/page.module.css.
```

The string is intentionally compact — designed to be pasted inline
before a question rather than as a standalone document:

```bash
# User pastes context, then types their question
claude "Context: dashboard/page.tsx → .rect_a1b2 (div, flex row...)
  The gap between children looks too large. What is causing it?"
```

**Keyboard shortcut**

`Cmd+Shift+C` (Mac) / `Ctrl+Shift+C` (Windows/Linux) copies the
context when an element is selected, normal copy when no element
is selected or when focus is in a text field.

**No element selected state**

When nothing is selected, clicking the button copies the page context
only (no element details):

```
Context: dashboard/page.tsx — 4 elements on canvas, desktop breakpoint
(1440px). Full page code in app/dashboard/page.tsx and
app/dashboard/page.module.css.
```

**Implementation notes**

- The copied string is generated from Zustand state in the renderer —
  no IPC call needed, no file read
- The "Copied" confirmation uses a short CSS transition on the button
  icon — no toast, no modal
- The shortcut must not conflict with CodeMirror's copy shortcut when
  the CSS editor has focus — check focus state before intercepting

**Done when:** Clicking the button while an element is selected copies
a useful context string. Pasting it before a terminal prompt gives
the agent enough information to understand which element is being
discussed without further description.

---

## 3. Scamp MCP server

**User story**

As a user running a coding agent in the Scamp terminal, I want the
agent to be able to actively query the current canvas state using
MCP tools so it can look up exactly what is selected, what styles
are applied, and what the full element tree looks like — without
relying on a file that might be slightly stale.

**Overview**

Scamp runs a lightweight local MCP server in the Electron main process.
The agent connects to it at the start of a session and can call tools
to query live canvas state. Unlike the context file (which is a
snapshot) and the copy button (which is a one-time copy), the MCP
server gives the agent real-time access to query whatever it needs
whenever it needs it.

Claude Code has MCP support built in. Other agents (Aider, Gemini CLI)
are adding MCP support — this architecture is forward-compatible.

**MCP server location**

The server runs on a local port (default `localhost:39841`) and is
started automatically when Scamp launches with a project open. It
stops when the project is closed or the app quits.

The port is written to `.scamp/mcp.json` when the server starts:

```json
{
  "url": "http://localhost:39841/mcp",
  "started_at": "2026-05-01T10:00:00Z",
  "project": "my-portfolio"
}
```

**agent.md addition**

```markdown
## MCP server

Scamp runs a local MCP server while the app is open.
Connection details are in `.scamp/mcp.json`.

Connect at the start of each session to query live canvas state:

claude mcp add scamp $(cat .scamp/mcp.json | jq -r '.url')
```

**Available tools**

```
scamp_get_active_page()
  Returns the active page name and file paths.
  → { page: "dashboard", tsx: "app/dashboard/page.tsx",
      css: "app/dashboard/page.module.css" }

scamp_get_selected_element()
  Returns full details of the currently selected element.
  → { id: "a1b2", class: "rect_a1b2", tag: "div", name: "sidebar",
      parentId: "root", childIds: ["c3d4", "e5f6"],
      styles: { display: "flex", gap: "16px", ... },
      customProperties: { "box-shadow": "0 2px 8px ..." } }
  → null if nothing is selected

scamp_get_element_by_id(id: string)
  Returns details of any element by its scamp ID.
  → same shape as scamp_get_selected_element()

scamp_get_element_tree()
  Returns the full element tree for the active page.
  → { root: { id, class, tag, children: [...] } }

scamp_get_canvas_state()
  Returns a full snapshot of the current canvas state — all elements,
  all styles, active page, selected element, active breakpoint.
  → { activePage, selectedElementId, breakpoint, elements: {...} }

scamp_list_pages()
  Returns all pages in the project.
  → [{ name: "home", tsx: "app/page.tsx" },
     { name: "dashboard", tsx: "app/dashboard/page.tsx" }]

scamp_list_components()
  Returns all components in the project with their variants.
  → [{ name: "Button", variants: ["solid", "outline", "ghost"],
       path: "components/Button/Button.tsx" }]

scamp_get_theme_tokens()
  Returns all theme tokens defined in theme.css.
  → { colors: {...}, typography: {...}, spacing: {...} }
```

**Implementation**

The MCP server runs in the Electron main process as a lightweight
HTTP server using Node's built-in `http` module — no external
dependency needed:

```ts
// src/main/mcpServer.ts
import http from 'http';
import { getCanvasState } from './canvasState';

export const startMcpServer = (port: number = 39841): http.Server => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const { tool, params } = JSON.parse(body);
        const result = handleTool(tool, params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
      });
    }
  });

  server.listen(port);
  return server;
};

const handleTool = (tool: string, params: Record<string, unknown>) => {
  const state = getCanvasState();

  switch (tool) {
    case 'scamp_get_active_page':
      return state.activePage;
    case 'scamp_get_selected_element':
      return state.selectedElementId
        ? state.elements[state.selectedElementId]
        : null;
    case 'scamp_get_element_by_id':
      return state.elements[params.id as string] ?? null;
    case 'scamp_get_element_tree':
      return buildElementTree(state);
    case 'scamp_get_canvas_state':
      return state;
    case 'scamp_list_pages':
      return state.pages;
    case 'scamp_list_components':
      return state.components;
    case 'scamp_get_theme_tokens':
      return state.themeTokens;
    default:
      return { error: 'unknown_tool', tool };
  }
};
```

The canvas state needed by the MCP server is maintained in the main
process. The renderer sends state updates via IPC whenever Zustand
state changes — the same mechanism that drives file writes already
keeps the main process informed.

**Security**

The MCP server only accepts connections from `localhost` — it binds
to `127.0.0.1` not `0.0.0.0`. No credentials are needed since only
processes running on the user's own machine can connect.

**Port conflict handling**

If port `39841` is in use, Scamp tries the next 10 ports in sequence
and uses the first available one. The actual port is always written
to `.scamp/mcp.json` so `agent.md`'s instructions work regardless.

**Done when:** Claude Code can connect to the Scamp MCP server, call
`scamp_get_selected_element()`, and return accurate details about
the currently selected element on the canvas. The agent can ask
"what is the selected element" and get a structured answer rather
than relying on the user to describe it.

---

## Relationship between the three stories

These three features are complementary, not alternatives. A user who
has all three gets:

- **Context file** — the agent always has a baseline of current state
  to reference, even if it was not explicitly told to look
- **Copy button** — zero-friction way to inject context into a specific
  prompt mid-session
- **MCP server** — the agent can proactively query state whenever it
  needs to, making multi-step operations much more reliable

A user who only has the context file is already significantly better
off than today. Each story ships independently and adds value on its
own.

---

## 4. Scamp Agent — native AI assistant

**User story**

As a Scamp user who does not want to set up a coding agent, manage
a Claude account, or use the terminal, I want a built-in AI assistant
panel where I can describe what I want in plain language and Scamp
makes the changes directly on my canvas, so I get the power of an
AI-assisted design workflow with no setup required.

**Overview**

Scamp Agent is a native AI assistant built directly into the Scamp
UI. It is powered by the Anthropic API under the hood and uses the
MCP server (story 3) to read and write canvas state. The user never
needs a terminal, a Claude account, or any configuration — they just
open the panel and start prompting.

This is the natural progression of the three context stories. The
context file and MCP server were built so external agents could
understand Scamp. Scamp Agent uses that same infrastructure but
brings the agent inside the product — a fully integrated AI workflow
like Lovable or v0, but for a local-first design tool that outputs
real code.

**Depends on:** Story 3 (MCP server) must be complete. The MCP tools
are what give the agent structured access to canvas state rather than
relying on file reads alone.

**Tier:** Scamp Agent is a Pro feature. Free users see the panel but
are prompted to upgrade. API costs are covered by Scamp's Anthropic
API account — no user API key required.

---

**The Agent panel**

A new "Agent" button in the toolbar (or keyboard shortcut `Cmd+Shift+A`)
opens the Agent panel as a right-side drawer alongside the properties
panel:

```
┌─────────────────────────────────────────────────────┐
│  Agent                                    [ × ]     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  make the hero section full width and        │   │
│  │  change the background to the brand color    │   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Context: home / rect_a1b2 selected         [ ✎ ]  │
│                                     [ Send  ↵ ]    │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ● Agent                                            │
│  I can see the hero section (rect_a1b2, full-width  │
│  div, currently 1200px wide). Updating width to     │
│  100% and background to var(--color-brand).         │
│                                                     │
│  ✓ Updated rect_a1b2 — width: 100%                  │
│  ✓ Updated rect_a1b2 — background: var(--color-brand)│
│                                                     │
│  Done. The hero is now full width with your brand   │
│  color. Want me to adjust the text contrast too?   │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ● You                                              │
│  yes and also center the heading                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The panel is a conversation — multi-turn, with full history visible.
Each agent response shows what it did with specific change confirmations
so the user always knows what was modified.

---

**Context awareness**

The agent always knows:
- Which page is open
- Which element is selected (if any)
- The element's current styles
- The full element tree for the active page
- All theme tokens defined in `theme.css`
- All components and their variants
- The project's `design.md` and `agent.md` if they exist

This context is assembled from the MCP server tools at the start of
every message. The user sees a context summary below the input field:

```
Context: home / rect_a1b2 selected
```

A pencil icon next to the context summary lets the user override it —
for example telling the agent to focus on a different element or page
than the currently selected one.

When no element is selected the context shows:

```
Context: home / no element selected
```

And the agent has access to the full page tree but is not focused on
a specific element.

---

**What the agent can do**

The agent has two categories of capability: read and write.

**Read (via MCP tools):**
- Get the active page and its file paths
- Get any element's styles and structure
- Get the full element tree
- Get all theme tokens
- List all pages and components

**Write (via file operations):**
- Edit CSS properties on any element by writing to the CSS module file
- Add new elements to a page by editing the TSX file
- Create or edit components
- Update theme tokens in `theme.css`
- Update `design.md` with new design decisions

All writes go through the existing file write pipeline — the same path
that canvas edits use. chokidar detects the changes and the canvas
updates automatically. The agent never writes to files directly; it
calls the same IPC channels the canvas uses, so all changes are
atomic and round-trip correctly through `parseCode`.

**What the agent cannot do:**

- Delete pages or components without explicit confirmation
- Rename elements (uses the `element:rename` IPC channel which
  requires user confirmation)
- Access files outside the project folder
- Make network requests on behalf of the user

---

**The agent loop**

Each user message goes through this cycle:

```
1. User sends a prompt
2. Scamp assembles context from MCP tools:
   - scamp_get_active_page()
   - scamp_get_selected_element() (if selection exists)
   - scamp_get_theme_tokens()
   - Any additional context relevant to the prompt
3. Scamp sends to Anthropic API (claude-sonnet-4-6):
   - System prompt with Scamp conventions and project context
   - Full conversation history
   - Current MCP-assembled context
   - User's message
4. Agent responds with:
   - A plain language explanation of what it is going to do
   - A structured list of file edits (CSS changes, TSX changes)
5. Scamp applies the edits via IPC channels
6. Canvas updates via chokidar
7. Agent confirms what changed in the panel
8. Conversation continues
```

The agent response and file edits are streamed — the user sees the
agent's explanation appear word by word and each change confirmation
appear as edits are applied. The canvas updates in real time as the
agent writes.

---

**System prompt**

The system prompt bakes in Scamp's conventions so the agent always
produces code that round-trips correctly:

```
You are Scamp Agent, an AI design assistant built into Scamp —
a local-first design tool that saves as real TSX and CSS Modules.

You have access to the current canvas state via MCP tools. When
making changes, you write to files using Scamp's IPC channels.
All CSS changes must use Scamp's cssPropertyMap conventions.
Never write raw hex values when a theme token exists.
Never remove data-scamp-id attributes.
Never add inline styles — always use CSS Module classes.
Refer to agent.md and design.md for project conventions.

When you make a change, confirm it with a short specific message:
"Updated rect_a1b2 — display: flex" not "I made some changes".

When you are unsure about intent, ask one clarifying question
before making changes. Do not make assumptions about structure.
```

---

**Undo and safety**

Every agent edit session creates a snapshot (using the snapshot system
from feature-snapshots.md) before the first change is applied. If the
agent produces unexpected results the user can restore the pre-session
snapshot from the history panel with one click.

A "Revert last change" button appears in the agent panel after each
confirmed change — it undoes just that edit without reverting the
entire session.

The agent never makes changes without showing what it intends to do
first. For any operation that affects more than 5 elements, the agent
shows a summary and asks for confirmation before writing:

```
I am going to update 8 elements across 3 pages to use
var(--color-brand) instead of #3b82f6.

[ Apply ]   [ Cancel ]
```

---

**Suggested prompts**

When the panel is empty (new conversation) a set of suggested prompts
is shown based on context:

When an element is selected:
```
  "Change this to a flex column layout"
  "Make this full width"
  "Apply the H1 text style to this heading"
  "Add a hover state with a subtle background"
```

When nothing is selected:
```
  "Add a new section below the hero"
  "Create a card component with a title and body"
  "Apply the brand color scheme to this page"
  "Make this page responsive for mobile"
```

Clicking a suggestion populates the input field — the user can send
it as-is or edit it first.

---

**Conversation history**

- Each page has its own conversation history — switching pages starts
  a fresh context but the previous page's conversation is preserved
- Conversation history is stored in `.scamp/agent-history/[page].json`
  and persists between sessions
- A "Clear conversation" button resets the history for the current page
- Conversation history is gitignored alongside the rest of `.scamp/`

---

**Model and cost**

- Default model: `claude-sonnet-4-6` — the best balance of capability
  and cost for this use case
- A typical agent exchange (context assembly + response + edits) uses
  approximately 3,000-8,000 tokens
- At Sonnet pricing ($3/$15 per million tokens) a typical exchange
  costs $0.01-0.05
- A power user doing 50 agent exchanges per day costs roughly $0.50-2.50
  per day in API costs — well within what Pro subscription revenue covers

---

**Implementation notes**

- The Anthropic API call is made from the Electron main process — never
  from the renderer. The API key is stored securely in the main process
  and never exposed to the renderer
- Streaming responses are passed from main to renderer via IPC events
  so the panel updates word by word without waiting for the full response
- The agent's file edit instructions are validated against the project's
  IPC channel types before being applied — malformed instructions are
  rejected and the agent is asked to try again
- The panel remembers its open/closed state between sessions

---

## Updated relationship of all four stories

```
.scamp/context.md          — passive context always available to
                             any agent in the terminal

Copy context button        — active context injection for specific
                             terminal prompts

Scamp MCP server           — structured real-time query tool for
                             agents that support MCP (Claude Code,
                             Aider, Gemini CLI)

Scamp Agent panel          — fully integrated native AI assistant,
                             no terminal or external account needed,
                             uses MCP internally, powered by
                             Anthropic API
```

All four coexist. Technical users who prefer their own agent and
terminal workflow still have stories 1-3. Users who want a simpler
integrated experience use story 4. Both workflows produce the same
output — changes written to real files that round-trip through the
canvas.