# CLAUDE.md — Scamp App

This file is read by Claude Code on every session. Follow everything here without being asked.

---

## Project Overview

Scamp is a local-first Electron design tool. Users draw rectangles on a canvas and the app auto-saves real TSX + CSS Module files. Bidirectional sync means external edits (agent or manual) reload the canvas. The stack is Electron + electron-vite + React + TypeScript + Zustand.

See `prd-scamp-poc.md` for full product context.

---

## Non-Negotiable Rules

- **Never write `any`** in TypeScript — use proper types or `unknown` with a type guard
- **Never skip tests** for anything in `src/renderer/lib/` — these are pure functions and must be fully tested
- **Never use `console.log` for debugging** — use the logger utility or remove before committing
- **Never hardcode IPC channel name strings** — always use constants from `src/shared/ipcChannels.ts`
- **Never read from disk in the renderer** — all file operations go through IPC

---

## Code Standards

### TypeScript

- Strict mode is on — no exceptions
- Prefer `type` over `interface` unless you need declaration merging
- All function arguments and return types must be explicitly typed
- No implicit returns in functions that should return a value
- Use `const` by default; `let` only when reassignment is necessary
- Avoid `!` non-null assertions — handle nulls explicitly

```ts
// ✅
const getElement = (id: string): Element | null => {
  return elements[id] ?? null;
};

// ❌
const getElement = (id: string) => {
  return elements[id]!;
};
```

### React

- Functional components only — no class components
- One component per file
- Props types defined in the same file as the component, above it
- No prop drilling more than 2 levels — use Zustand store instead
- `useEffect` dependencies must be complete and correct — no suppression comments
- Event handlers named `handle[Event]` (e.g. `handleClick`, `handleMouseDown`)

```tsx
// ✅
type Props = {
  elementId: string;
  onSelect: (id: string) => void;
};

const ElementRenderer = ({ elementId, onSelect }: Props): JSX.Element => { ... };

// ❌
const ElementRenderer = (props: any) => { ... };
```

### File and Folder Naming

- React components: `PascalCase.tsx`
- Hooks: `camelCase.ts` prefixed with `use` (e.g. `useDrawTool.ts`)
- Utilities and lib files: `camelCase.ts`
- Test files: `[filename].test.ts` in `test/` at root
- CSS Modules for app UI: `ComponentName.module.css` alongside the component

### Imports

- Use path aliases — never relative `../../..` chains more than one level deep
- Alias `@renderer` → `src/renderer`
- Alias `@lib` → `src/renderer/lib`
- Alias `@store` → `src/renderer/store`
- Group imports: external packages first, then internal aliases, then relative — blank line between groups

```ts
// ✅
import { useEffect } from 'react';
import { css } from '@codemirror/lang-css';

import { useCanvasStore } from '@store/canvasSlice';
import { parseCode } from '@lib/parseCode';

import { SelectionOverlay } from './SelectionOverlay';
```

### Zustand

- One slice per domain — never put everything in one store file
- Slices export their own types
- Actions are defined inside the slice alongside state
- Never mutate state directly — use Immer or spread

### IPC (Electron)

- All IPC channel names are constants in `src/shared/ipcChannels.ts` — never hardcode strings
- Main process handlers live in `src/main/ipc/` — one file per domain
- All IPC payloads have explicit TypeScript types defined in `src/shared/types.ts`
- Preload only exposes what the renderer actually needs — keep the surface minimal
- Handlers do one thing — keep them small and composable

---

## Testing

### What Must Be Tested

Everything in `src/renderer/lib/` must have full meaningful test coverage:

| File | What to test |
|---|---|
| `generateCode.ts` | TSX structure, CSS output, default omission, nesting, customProperties passthrough, text elements |
| `parseCode.ts` | Round-trip from generated output, external edits, missing properties fall back to defaults, unknown properties go to customProperties |
| `parsers.ts` | Every shorthand format for `border` and `padding`, px parsing, edge cases |
| `cssPropertyMap.ts` | Every mapped property, width/height mode switching, unmapped properties |
| `defaults.ts` | Default values are correct and complete |

### Test Standards

- Use **Vitest** (configured with electron-vite)
- Test files in `test/` at root, named `[filename].test.ts`
- Every test has a clear description — no `it('works')` or `it('test 1')`
- Tests grouped with `describe` blocks by function or behavior
- Use specific assertions — no `toBeTruthy()` when you can use `toEqual()`
- Always test the unhappy path — nulls, empty strings, malformed input, missing properties
- No mocking of `src/renderer/lib/` functions — they are pure, test them directly

```ts
// ✅
describe('parseBorderShorthand', () => {
  it('parses a full shorthand: 1px solid #ccc', () => {
    expect(parseBorderShorthand('1px solid #ccc')).toEqual({
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#ccc',
    });
  });

  it('returns default border when given an empty string', () => {
    expect(parseBorderShorthand('')).toEqual({
      borderWidth: 0,
      borderStyle: 'none',
      borderColor: '#000000',
    });
  });
});

// ❌
it('parses border', () => {
  expect(parseBorderShorthand('1px solid #ccc')).toBeTruthy();
});
```

### Integration Tests

Integration tests live in `test/integration/` and are also run with Vitest. They test across module boundaries — things unit tests can't catch — without needing to launch the full Electron app.

**What integration tests cover:**

| Test | What it validates |
|---|---|
| `sync.integration.test.ts` | `generateCode` output is written to a temp file, read back, parsed by `parseCode`, and the result matches the original state |
| `filePatch.integration.test.ts` | The `file:patch` logic finds the right class block in a CSS module, replaces only that block, and leaves the rest of the file untouched |
| `externalEdit.integration.test.ts` | Simulates an agent editing a CSS file — writes modified CSS to disk, runs `parseCode`, asserts the changed property is reflected in the element tree and nothing else changed |

**Integration test standards:**

- Use `os.tmpdir()` to create a real temp directory per test — clean it up in `afterEach`
- No mocking of `fs` — use the real file system via a temp dir
- No mocking of `generateCode` or `parseCode` — test them for real
- Keep tests independent — each test sets up and tears down its own files
- These are slower than unit tests and that is fine — correctness matters more here

```ts
// ✅ Integration test structure
describe('file patch integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canvas-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('replaces only the target class block and leaves others untouched', async () => {
    const cssPath = path.join(tmpDir, 'home.module.css');
    await fs.writeFile(cssPath, originalCss);

    await patchClass(cssPath, 'rect_a1b2', 'background: red;\nwidth: 200px;');

    const result = await fs.readFile(cssPath, 'utf-8');
    expect(result).toContain('.rect_a1b2');
    expect(result).toContain('background: red;');
    expect(result).toContain('.rect_c3d4'); // other class untouched
  });
});
```

### Running Tests

```bash
npm run test                # run all tests (unit + integration)
npm run test:unit           # unit tests only
npm run test:integration    # integration tests only
npm run test:watch          # watch mode
npm run test:coverage       # coverage report
```

Tests must pass before any commit that touches `src/renderer/lib/` or `src/main/ipc/`.

### Future: E2E Tests

Playwright with its Electron mode will be added post-POC for full end-to-end tests that launch the real app. Not in scope now — the UI is too unstable to write E2E tests against during the POC phase.

---

## The Two Core Functions

These are the most critical files in the codebase. Run tests after every meaningful change to either.

### `generateCode(elements, rootId, pageName) → { tsx: string, css: string }`

- Pure function — no side effects, no IPC, no store reads
- Only emits CSS properties that differ from `DEFAULT_RECT_STYLES`
- Always appends `customProperties` verbatim at the end of each class block
- Traverses element tree depth-first
- Text content must be HTML-escaped

### `parseCode(tsx: string, css: string) → ElementTree`

- Pure function — no side effects
- Applies `DEFAULT_RECT_STYLES` as baseline before overlaying parsed values
- Unknown CSS properties go into `customProperties`, never discarded
- Must handle both shorthand and longhand CSS forms for border and padding
- Must be the inverse of `generateCode`

### Round-trip invariant

This test must always exist and always pass:

```ts
it('round-trips cleanly: generateCode → parseCode reproduces original state', () => {
  const { tsx, css } = generateCode(elements, rootId, 'home');
  const parsed = parseCode(tsx, css);
  expect(parsed).toEqual(elements);
});
```

---

## What Not to Do

- Don't add dependencies without a good reason — keep the bundle lean
- Don't add a dependency for something achievable in ~20 lines of TypeScript
- Don't build WYSIWYG controls (color pickers, sliders, dropdowns) — that is post-POC scope
- Don't put canvas or page state in React component state — it belongs in Zustand
