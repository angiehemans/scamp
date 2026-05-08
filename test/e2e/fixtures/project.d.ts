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
    /** Read `home.tsx` from disk. */
    readTsx: () => Promise<string>;
    /** Read `home.module.css` from disk. */
    readCss: () => Promise<string>;
    /** Read `theme.css` from disk. */
    readTheme: () => Promise<string>;
    /** Recursively delete the project's temp dir. */
    cleanup: () => Promise<void>;
};
export type CreateTestProjectOptions = {
    /** Project directory's basename. Defaults to `scamp-e2e`. */
    name?: string;
    /**
     * Extra pages to seed beyond the default `home` page. Each name
     * gets a default TSX + CSS module written to disk. The app's page
     * scanner will pick them up on open. Default: no extras.
     */
    extraPages?: ReadonlyArray<string>;
};
export declare const createTestProject: (options?: CreateTestProjectOptions | string) => Promise<TestProject>;
