# Scamp

A local-first design tool that lets you visually compose layouts using nested rectangles and flex controls. Unlike traditional design tools, the output is real code — each page saves as a `.tsx` file plus a `.module.css` file that update in real time as you design.

The full product brief lives in [`prd-scamp-poc.md`](./prd-scamp-poc.md). The contributor rules live in [`CLAUDE.md`](./CLAUDE.md).

## Stack

- **Electron** + **electron-vite** — desktop shell with native file system access
- **React 18** + **TypeScript** (strict) — UI
- **Zustand** — canvas state
- **CSS Modules** — app styling
- **chokidar** — file watching for bidirectional sync
- **Vitest** — unit + integration tests

## Repo layout

```
src/
├── main/                  Electron main process
│   ├── index.ts             entry, BrowserWindow setup
│   ├── watcher.ts           chokidar wrapper, write-suppression set
│   └── ipc/                 one file per IPC domain
│       ├── project.ts       choose folder, create/open project
│       ├── file.ts          atomic write + class-block patch
│       ├── page.ts          page create/delete
│       └── recentProjects.ts  recent projects store
├── preload/               contextBridge exposing window.scamp
├── shared/                code shared by main/preload/renderer
│   ├── ipcChannels.ts       channel name constants — never hardcode
│   ├── types.ts             IPC payload types
│   └── agentMd.ts           agent.md template + default page files
└── renderer/              React app
    ├── lib/                 pure functions (defaults, element type)
    ├── store/               Zustand slices
    └── src/
        ├── App.tsx
        ├── canvas/          viewport, element renderer, interaction layer
        └── components/      start screen, project shell, toolbar
test/                       Vitest unit + integration tests
```

## Scripts

```bash
npm run dev             # launch the Electron app with HMR
npm run build           # production build into out/
npm run typecheck       # tsc --noEmit (node + web projects)
npm run test            # all tests
npm run test:unit       # unit only
npm run test:integration  # integration only
npm run test:watch      # watch mode
```

## Current state

| Milestone | Status |
|---|---|
| M1 — Electron shell + file system | ✅ |
| M2 — Canvas + rectangle drawing | ✅ |
| M3 — `generateCode` / `parseCode` + panel editor | ✅ |
| M4 — Code panel + external sync | ✅ |
| M5 — Text + terminal | ✅ |

### What works today

- Create or open a project from the start screen via native folder dialog
- Recent projects persisted at `app.getPath('userData')/recentProjects.json`, displayed on the start screen, greyed out if the folder is missing
- New projects get an auto-generated `agent.md`, `home.tsx`, and `home.module.css`
- chokidar watches the active project and emits `file:changed` to the renderer (with a write-suppression set so canvas-originated writes don't echo back)
- `file:write` writes both halves of a page atomically (write to `.tmp`, then rename)
- `file:patch` replaces a single class block in a CSS module file
- 1440×900 canvas viewport that scales to fit the available panel space
- Rectangle tool — click-drag to create a rect; min size 20×20; nested rects are drawn inside the deepest rect under the cursor
- Select tool — click to select, drag to move, 8 resize handles to resize
- Keyboard shortcuts — `V` for select, `R` for rectangle
- Forced dark mode at the OS theme, BrowserWindow, and HTML levels

### What's coming next (M3)

- `generateCode(elements, rootId, pageName) → { tsx, css }` (pure, fully tested)
- `parseCode(tsx, css) → ElementTree` (pure, fully tested, inverse of generateCode)
- Debounced canvas → file writes
- CodeMirror panel editor for the selected element's class body
- Round-trip sync: edit panel → file → re-parse → state → re-render

## Conventions

- Strict TypeScript — no `any`, all function signatures explicit
- IPC channel names live in `src/shared/ipcChannels.ts` — never hardcoded
- The renderer never reads from disk — every file operation goes through IPC
- Path aliases: `@renderer`, `@lib`, `@store`, `@shared`
- Anything in `src/renderer/lib/` must have meaningful test coverage (see CLAUDE.md)

## License

MIT
