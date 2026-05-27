/**
 * A throwaway on-disk project for a single spec. Produces the legacy
 * flat layout (the app supports both `legacy` and `nextjs` formats;
 * the e2e suite exercises legacy because the existing specs assert on
 * flat file paths). The app opens it straight away via the
 * SCAMP_E2E_OPEN_PROJECT env var.
 *
 * A `scamp.config.json` is written with `nextjsMigrationDismissed: true`
 * so the legacy → nextjs migration banner stays out of the way of the
 * canvas during tests. Other config fields are left out and backfilled
 * to defaults by `openProject` on first read.
 */
export type TestProject = {
    /** Absolute path to the project directory. */
    dir: string;
    /** Project name — the directory's basename. */
    name: string;
    /** Default page name, always 'home'. */
    pageName: string;
    /** 'legacy' (flat) or 'nextjs' (App Router). */
    format: 'legacy' | 'nextjs';
    /** Read the home page's TSX from disk (path differs by format). */
    readTsx: () => Promise<string>;
    /** Read the home page's CSS module from disk. */
    readCss: () => Promise<string>;
    /** Read an arbitrary page's TSX/CSS by name. */
    readPage: (pageName: string) => Promise<{
        tsx: string;
        css: string;
    }>;
    /** Read a component's TSX/CSS by PascalCase name. Throws if missing. */
    readComponent: (componentName: string) => Promise<{
        tsx: string;
        css: string;
    }>;
    /** True iff `components/<name>/<name>.tsx` exists. */
    componentExists: (componentName: string) => Promise<boolean>;
    /** Read `theme.css` from disk. */
    readTheme: () => Promise<string>;
    /** Recursively delete the project's temp dir. */
    cleanup: () => Promise<void>;
};
export type SeedComponent = {
    name: string;
    /** Optional TSX content; defaults to a blank scaffold. */
    tsxContent?: string;
    /** Optional CSS module content; defaults to `.root {}`. */
    cssContent?: string;
};
export type CreateTestProjectOptions = {
    /** Project directory's basename. Defaults to `scamp-e2e`. */
    name?: string;
    /** Project format. Defaults to `'legacy'` for back-compat. */
    format?: 'legacy' | 'nextjs';
    /**
     * Extra pages to seed beyond the default `home` page. Each name
     * gets a default TSX + CSS module written to disk. The app's page
     * scanner will pick them up on open. Default: no extras.
     */
    extraPages?: ReadonlyArray<string>;
    /**
     * Override page content before launch. Maps `pageName → { tsx, css }`.
     * Use for specs that need a page to already reference a component
     * etc. Default scaffold runs first, then these overrides are
     * applied. Writing AFTER the app opens races the format-migration
     * write, so pre-seeding here is the only reliable shape.
     */
    pageContent?: Record<string, {
        tsx?: string;
        css?: string;
    }>;
    /**
     * Pre-seed `components/<Name>/<Name>.tsx` + `.module.css` files.
     * Only honoured for `format: 'nextjs'` (legacy doesn't support
     * components). Default: no components.
     */
    components?: ReadonlyArray<SeedComponent>;
};
export declare const createTestProject: (options?: CreateTestProjectOptions | string) => Promise<TestProject>;
