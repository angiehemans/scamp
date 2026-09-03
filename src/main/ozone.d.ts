/**
 * Linux ozone-platform selection.
 *
 * Electron 44 segfaults during window creation under the Wayland
 * ozone backend on some Linux systems, so Scamp forces X11
 * (XWayland) by default and offers an escape hatch.
 * see docs/notes/linux-wayland-ozone.md
 */
/** What Chromium should be told, or `null` to leave the default alone. */
export type OzoneDecision = string | null;
type ResolveInput = {
    platform: NodeJS.Platform;
    argv: readonly string[];
    override: string | undefined;
};
/**
 * Decide the value for `--ozone-platform`, or `null` to append nothing.
 *
 * Pure — no Electron, no process access. Precedence, highest first:
 * an explicit `--ozone-platform` on argv, then `SCAMP_OZONE_PLATFORM`
 * (where `auto` means "let Electron choose"), then the x11 default.
 */
export declare const resolveOzonePlatform: ({ platform, argv, override, }: ResolveInput) => OzoneDecision;
export {};
