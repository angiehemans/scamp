// templates/pageScaffold.ts — page/layout TSX + package.json scaffolding templates.
// Split out of src/shared/agentMd.ts (4.6); re-exported via the barrel.

/**
 * Default page TSX content for a freshly created page. The
 * `cssModuleImportName` defaults to `moduleName`, which gives the
 * legacy flat-layout import (`./<page>.module.css`); pass `'page'` for
 * the Next.js App Router layout where every page imports its co-
 * located `./page.module.css` regardless of slug.
 */
export const defaultPageTsx = (
  componentName: string,
  moduleName: string,
  cssModuleImportName: string = moduleName
): string => {
  return `import styles from './${cssModuleImportName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root}>
    </div>
  );
}
`;
};


/**
 * Auto-generated `app/layout.tsx` for a Next.js-format project. Imports
 * the project's `theme.css` so the design tokens it defines apply when
 * the user runs `next dev` outside Scamp. The user is documented (in
 * `agent.md`) to leave this file alone.
 *
 * The `<body>` carries `margin: 0` and `minHeight: '100vh'` — body
 * chrome that needs to live somewhere visible to Next.js but isn't a
 * design choice. The default font-family lives in `theme.css` (a
 * `body { font-family: var(--font-sans); }` rule) so it shows up
 * alongside the other design tokens the user can edit.
 */
export const defaultLayoutTsx = (projectName: string): string => {
  return `import type { Metadata } from 'next';
import './theme.css';

export const metadata: Metadata = {
  title: '${projectName}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh' }}>{children}</body>
    </html>
  );
}
`;
};


/**
 * Earlier `defaultLayoutTsx` outputs that `migrateLayoutTemplate`
 * should treat as "user hasn't customised this — safe to replace
 * with the latest template." Only literal byte-for-byte matches
 * count: any user edit (rename, reformatting, additional imports)
 * fails the comparison and the legacy template is left alone.
 *
 * Append (don't replace) when changing `defaultLayoutTsx`: every
 * past version of the auto-generated layout needs to remain
 * matchable so users on old Scamp installs can migrate forward
 * later.
 */
export const LEGACY_LAYOUT_TEMPLATES = (projectName: string): readonly string[] => [
  // Pre-2026-05-01 — no body reset.
  `import type { Metadata } from 'next';
import './theme.css';

export const metadata: Metadata = {
  title: '${projectName}',
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
`,
];


/**
 * Auto-generated `package.json` for a Next.js-format project. Pinned
 * minor versions for the Next.js / React stack so a Scamp-created
 * project doesn't quietly drift onto a major-version bump that breaks
 * the App Router conventions Scamp relies on.
 */
export const defaultPackageJson = (projectName: string): string => {
  const data = {
    name: projectName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: {
      '@types/node': '^22.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.5.0',
    },
  };
  return `${JSON.stringify(data, null, 2)}\n`;
};

