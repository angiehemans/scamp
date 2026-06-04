# The `@/` import alias and scaffolded `tsconfig.json`

## Symptom

In a Scamp project that uses a component, previewing the page fails with:

```
Build Error
Module not found: Can't resolve '@/components/Namecard/Namecard'
./app/page.tsx
```

## Cause

`generateCode` emits component imports using the `@/` alias
(`import Namecard from '@/components/Namecard/Namecard'` — see
`src/renderer/lib/generateCode.ts`). Next.js only resolves `@/` if the
project's `tsconfig.json` (or `jsconfig.json`) declares it under
`compilerOptions.paths`. The original `scaffoldNextjsProject` never wrote
a `tsconfig.json`, so the alias was undefined.

This fails under `next dev` regardless of packaging. Worse: the first
`next dev` run **auto-creates a bare `tsconfig.json`** with Next's
recommended options but **without** the `@/*` path, so the file exists
yet the alias still doesn't resolve.

## Fix

`src/shared/tsconfigAlias.ts` owns the canonical template
(`DEFAULT_TSCONFIG_JSON`, create-next-app style with
`paths: { "@/*": ["./*"] }`) and a pure `ensureTsconfigAlias(current)`
that returns the contents to write:

- absent/empty → full template
- valid JSON missing the alias → inject `baseUrl: "."` + the `@/*` path,
  preserving all other fields (this repairs the bare file `next dev` made)
- alias already present → no-op (never clobber a user's mapping)
- unparseable JSONC → no-op + a logged warning

It is written by `scaffoldNextjsProject` for new projects and applied by
`ensureTsConfigIfNeeded` on project open for existing ones, alongside the
other `ensure*`/`refresh*` migrations in `src/main/ipc/project.ts`.

`baseUrl: "."` + `@/* -> ./*` resolves from the project root, matching
Scamp's layout where components live at `<root>/components/...` and pages
at `<root>/app/...`.
