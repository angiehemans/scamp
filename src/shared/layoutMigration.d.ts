/**
 * Decide what to do with an existing `app/layout.tsx` when a project
 * opens. Pure: takes the current file contents and the project name,
 * returns an action — no IO.
 *
 *   - `noop`     — file already matches the latest `defaultLayoutTsx`.
 *   - `replace`  — file byte-matches a known legacy template; safe to
 *                  refresh with the latest template.
 *   - `warn`     — file doesn't match any known template; the user (or
 *                  an agent) has customised it. Don't trample. Caller
 *                  should log a hint pointing at the missing body
 *                  reset so users who hit "preview is blank" can
 *                  diagnose it.
 *
 * The byte-match is strict: any user edit (extra import, reformat,
 * trailing whitespace) fails the comparison and falls through to the
 * `warn` branch. Append (don't replace) entries to
 * `LEGACY_LAYOUT_TEMPLATES` whenever `defaultLayoutTsx` changes so
 * users on old Scamp installs can migrate forward later.
 */
export type LayoutMigrationAction = {
    kind: 'noop';
} | {
    kind: 'replace';
    next: string;
} | {
    kind: 'warn';
    reason: string;
};
export declare const decideLayoutMigration: (current: string, projectName: string) => LayoutMigrationAction;
