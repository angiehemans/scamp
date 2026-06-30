# Scamp — Next.js App Router File Structure

**User story**

As a user creating a new Scamp project, I want my project files to follow
Next.js App Router conventions so I can drop the project directly into a
Next.js app without reorganising anything, and run it as a real Next.js
project outside of Scamp with no extra setup.

As an existing Scamp user with projects in the old flat file structure, I
want my projects to keep working exactly as they do today so nothing breaks
when I update the app.

---

## New project structure

All new projects created after this change use the Next.js App Router
convention:

```
my-project/
├── agent.md
├── package.json              ← auto-generated, React + Next.js deps
├── next.config.ts            ← auto-generated, minimal config
├── app/
│   ├── layout.tsx            ← auto-generated, root layout
│   ├── page.tsx              ← root/home page
│   ├── page.module.css
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── page.module.css
│   └── about/
│       ├── page.tsx
│       └── page.module.css
└── public/
    └── assets/               ← images and media (served at /assets/)
```

## Page naming

- The root page is always `app/page.tsx` and `app/page.module.css`
- Additional pages live in named folders: `app/[page-name]/page.tsx`
- In the Scamp sidebar the root page is labelled "Home" — users never
  see the underlying `page.tsx` filename directly
- Page folder names follow the same validation as before: lowercase,
  alphanumeric and hyphens only, no spaces

## Auto-generated scaffold files

When a new project is created Scamp writes these files automatically.
The user never needs to touch them. They are documented in `agent.md`
as infrastructure files agents should not modify:

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Scamp Project',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

## Assets

Static assets (images, SVGs, fonts) live in `public/assets/`. Next.js
serves the `public/` directory at the root URL, so a file at
`public/assets/hero.png` is accessible at `/assets/hero.png`.

CSS background image references use the absolute root path:
```css
background-image: url('/assets/hero.png');
```

TSX `<img>` elements reference the same path:
```tsx
<img src="/assets/hero.png" alt="" />
```

The `agent.md` template documents this convention so agents always place
images in `public/assets/` and reference them with the correct path.

## Preview mode

The local Vite dev server used in preview mode is replaced by `next dev`.
Because the project is a real Next.js app, running `next dev` in the
built-in terminal gives the user the full Next.js dev server with HMR,
routing, and image optimisation. No custom Vite config needed.

A user can also open their project in VS Code and run `npm run dev`
independently of Scamp and get the exact same result.

---

## Backward compatibility — old projects

Old projects (flat file structure: `home.tsx`, `home.module.css` in the
project root) are detected automatically when opened. Detection logic:

- If the project folder contains an `app/` directory: new format
- If the project folder contains `.tsx` files in the root: legacy format
- If neither: new empty project

**Legacy projects open and work exactly as they do today.** No forced
migration. The legacy parser and file writer remain in the codebase
alongside the new ones, selected based on which format the project uses.
This is stored in the project's metadata in the recent projects JSON:

```json
{
  "recentProjects": [
    {
      "name": "my-old-project",
      "path": "/Users/angie/dev/my-old-project",
      "format": "legacy",
      "lastOpened": "2026-04-01T09:00:00Z"
    },
    {
      "name": "my-new-project",
      "path": "/Users/angie/dev/my-new-project",
      "format": "nextjs",
      "lastOpened": "2026-04-07T10:00:00Z"
    }
  ]
}
```

## Optional migration for legacy projects

When a legacy project is opened, a subtle non-blocking banner appears
at the top of the canvas:

```
This project uses the legacy file structure.
[Migrate to Next.js format]  [Dismiss]
```

Clicking "Migrate to Next.js format" runs the migration automatically:

1. Creates the `app/` folder structure
2. Moves `home.tsx` to `app/page.tsx`, updates its CSS module import
3. Moves each `[page].tsx` to `app/[page]/page.tsx`, updates its CSS
   module import
4. Moves each `[page].module.css` to the corresponding `app/[page]/`
   folder
5. Moves any files in `assets/` to `public/assets/` and updates all
   CSS and TSX references from `../assets/` to `/assets/`
6. Generates `app/layout.tsx`, `next.config.ts`, and `package.json`
7. Updates `agent.md` with the new file structure conventions
8. Removes the old files from the root after confirming all moves
   succeeded
9. Updates the project's `format` in recent projects JSON to `nextjs`

Migration is atomic — if any step fails the project is left unchanged
and an error message explains what went wrong. The user is never left
with a half-migrated project.

Dismissing the banner suppresses it permanently for that project. The
project remains in legacy format indefinitely with no further prompts.

---

## `agent.md` template for new projects

```markdown
## Project structure

This is a Next.js App Router project.

- Root page: `app/page.tsx` and `app/page.module.css`
- Additional pages: `app/[page-name]/page.tsx` and
  `app/[page-name]/page.module.css`
- Shared layout: `app/layout.tsx` — do not modify
- Config: `next.config.ts` — do not modify
- Assets: `public/assets/` — reference as `/assets/filename.ext`

Do not move, rename, or restructure these files.
Each page exports a single default React component.
All styles live in the co-located CSS Modules file.
```

---

## Notes

- This is a breaking change in project format but not in user experience —
  existing projects are unaffected and new projects feel identical to use
- The legacy code paths (`generateCode`, `parseCode`, IPC handlers) should
  be clearly namespaced in the codebase: `generateCodeLegacy` vs
  `generateCode`, so the distinction is always obvious
- The migration tool should be tested thoroughly against a variety of
  real legacy projects before shipping — it is a destructive operation
  even if atomic
- Long term the legacy format can be deprecated once the majority of
  active projects have migrated, but there is no urgency to do this