# Contributing to Scamp

Thanks for your interest in contributing. This guide covers everything you need to get started.

## Getting started

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- A Linux, macOS, or Windows machine (Electron runs on all three)

### Setup

```bash
git clone <repo-url>
cd scamp
npm install
npm run dev
```

`npm run dev` starts the Electron app with hot module reload. The renderer rebuilds on save; the main process restarts automatically when its source changes.

### Verify your setup

```bash
npm run typecheck   # should exit cleanly
npm test            # should pass all tests
npm run build       # should produce output in out/
```

## Project structure

Scamp is an Electron app with three process layers:

| Layer | Directory | Runs in | Purpose |
|---|---|---|---|
| Main | `src/main/` | Node.js (Electron main) | Window management, file system, pty terminals, IPC handlers |
| Preload | `src/preload/` | Isolated bridge | Exposes `window.scamp` API via `contextBridge` |
| Renderer | `src/renderer/` | Chromium (React) | UI, canvas, state management |
| Shared | `src/shared/` | Both | IPC channel constants, payload types, templates |

Tests live in `test/` at the repo root, not alongside source files.

See the [README](./README.md) for the full directory tree.

## Code standards

The full coding standards are in [CLAUDE.md](./CLAUDE.md). That file is written for AI assistants but the rules apply equally to human contributors. The highlights:

### TypeScript
- Strict mode, no `any`, explicit function signatures
- Prefer `type` over `interface`
- Handle nulls explicitly — no `!` non-null assertions

### React
- Functional components only, one per file
- Props type defined above the component in the same file
- No prop drilling past 2 levels — use the Zustand store
- Event handlers named `handle[Event]`

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Tests: `filename.test.ts` in `test/`
- CSS Modules: `ComponentName.module.css` next to the component

### Imports
- Use path aliases (`@lib`, `@store`, `@renderer`, `@shared`) — no deep relative paths
- Group: external packages, then aliases, then relative — blank line between groups

### IPC
- Channel names are constants in `src/shared/ipcChannels.ts` — never hardcode strings
- Payload types live in `src/shared/types.ts`
- Main process handlers go in `src/main/ipc/`, one file per domain
- The renderer never touches the file system directly — everything goes through IPC

## Testing

### What to test

Everything in `src/renderer/lib/` must have meaningful test coverage. These are pure functions (no side effects, no IPC) so they're straightforward to test.

Key files and what their tests cover:

| File | Coverage |
|---|---|
| `generateCode.ts` | TSX structure, CSS output, default omission, nesting, text, customProperties |
| `parseCode.ts` | Round-trip fidelity, external edits, fallback to defaults, unknown props to customProperties |
| `parsers.ts` | Border/padding/margin shorthands, px parsing, edge cases |
| `cssPropertyMap.ts` | Every mapped CSS property, mode switching, unmapped properties |
| `defaults.ts` | Default values are correct and complete |

### How to write tests

```bash
npm test              # all tests
npm run test:unit     # unit only
npm run test:integration  # integration only
npm run test:watch    # watch mode
```

- Use **Vitest** (already configured)
- Test files go in `test/`, named `[filename].test.ts`
- Group with `describe`, write clear descriptions — no `it('works')`
- Use precise assertions (`toEqual`, not `toBeTruthy`)
- Test the unhappy path: nulls, empty strings, malformed input
- Don't mock `src/renderer/lib/` functions — they're pure, test them directly

### Integration tests

Integration tests live in `test/integration/`. They use the real file system (via `os.tmpdir()`) and real `generateCode`/`parseCode` — no mocks.

Each test creates a temp directory in `beforeEach` and cleans it up in `afterEach`.

### The round-trip invariant

This is the single most important test in the codebase:

```ts
it('round-trips cleanly: generateCode → parseCode reproduces original state', () => {
  const { tsx, css } = generateCode(elements, rootId, 'home');
  const parsed = parseCode(tsx, css);
  expect(parsed).toEqual(elements);
});
```

If you change `generateCode` or `parseCode`, run the full test suite. If the round-trip breaks, fix it before anything else.

## Architecture concepts

### The two core functions

`generateCode` and `parseCode` are the heart of Scamp. They convert between canvas state (`Record<string, ScampElement>`) and real TSX + CSS files. Both are pure functions with no side effects.

- `generateCode` only emits CSS properties that differ from defaults
- `parseCode` applies defaults as a baseline, then overlays parsed values
- Unknown CSS properties go into `customProperties` and round-trip untouched
- The generator and parser must be exact inverses of each other

### Canvas state

All canvas/page state lives in a Zustand store (`src/renderer/store/canvasSlice.ts`). Components read from the store via selectors and write via actions like `patchElement(id, patch)`. Never put canvas state in React component state.

### Sync bridge

`src/renderer/src/syncBridge.ts` subscribes to store changes and debounces writes to disk. The main process watches the project folder with chokidar. External edits trigger `file:changed` events that the renderer parses and loads into the store. A write-suppression set prevents canvas-originated writes from echoing back.

### Properties panel

The properties panel has two modes:
- **UI mode**: typed form controls grouped into sections (Position, Size, Layout, Spacing, Background, Border, Tag, Typography). Each section reads its slice of the store and writes via `patchElement`.
- **CSS mode**: raw CodeMirror editor that commits declarations via `file:patch`.

Both modes read the same store. Switching is instant and lossless.

### Element model

`ScampElement` (in `src/renderer/lib/element.ts`) is the canonical type for everything on the canvas. It covers rectangles and text elements with typed fields for layout, appearance, and typography. The `customProperties` bag preserves any CSS the model doesn't have a typed field for.

### Project formats — legacy and nextjs

Scamp supports two on-disk project layouts:

- **`nextjs`** — the default for new projects. A real Next.js App Router layout: pages live as `app/page.tsx` (root) or `app/<name>/page.tsx`, assets in `public/assets/`, with auto-generated `app/layout.tsx`, `next.config.ts`, and `package.json`.
- **`legacy`** — the original flat layout: `<page>.tsx` and `<page>.module.css` at the project root, assets in `assets/`. Existing projects keep working; users can opt into the migration via a banner.

The format is detected on every project open and cached in `projectFormatCache` (`src/main/ipc/projectFormatCache.ts`). The renderer mirrors it in the canvas store (`projectFormat`) so deeply-nested components don't have to thread it through props.

When a code path needs to behave differently per format:

- Pure functions (`generateCode`) take the difference as a parameter (e.g. `cssModuleImportName`) — call sites pick the right value based on the project's format.
- Main-process handlers (page ops, image copy, theme read/write) look up the format from the cache and dispatch internally.
- Legacy-only entry points (`generateCodeLegacy`, `scaffoldLegacyProject`, `AGENT_MD_CONTENT_LEGACY`) are clearly named so they are easy to delete once the legacy format is retired.

Bug fixes go into the new (nextjs) path; the legacy path is in maintenance mode.

## Making changes

### Adding a new CSS property to the model

1. Add the typed field to `ScampElement` in `src/renderer/lib/element.ts`
2. Add a mapper in `src/renderer/lib/cssPropertyMap.ts`
3. Add the emit branch in `generateCode.ts`
4. Update defaults if the property has a non-trivial default
5. Add tests for the mapper and generator
6. Add a round-trip integration test
7. Wire it into the properties panel UI (section component + control)
8. Apply it in `ElementRenderer.tsx` so it renders on the canvas

### Adding a new IPC channel

1. Add the channel name constant in `src/shared/ipcChannels.ts`
2. Define the payload type in `src/shared/types.ts`
3. Write the handler in `src/main/ipc/` (one file per domain)
4. Register the handler in the domain's `register*Ipc` function
5. Expose it in `src/preload/index.ts`
6. Call it from the renderer via `window.scamp.*`

### Adding a new UI control

Controls live in `src/renderer/src/components/controls/`. They are pure leaf components: `value` in, `onChange` out, no store knowledge. Section components (in `components/sections/`) are the glue that wires controls to `patchElement`.

### Adding a new properties panel section

1. Create `SectionName.tsx` in `components/sections/`
2. Read the relevant element fields via `useCanvasStore`
3. Write via `patchElement(elementId, { field: value })`
4. Import and render in `UiPanel.tsx`, gated by element type if needed

## Before submitting

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all 183+ tests)
- [ ] `npm run build` succeeds
- [ ] New code in `src/renderer/lib/` has test coverage
- [ ] No `any` types, no hardcoded IPC strings, no `console.log`
- [ ] Round-trip invariant still holds if you touched generateCode or parseCode

## License

MIT — see [LICENSE](./LICENSE) for details.
