/**
 * Linux ozone-platform selection.
 *
 * Electron 44 segfaults during window creation under the Wayland
 * ozone backend on some Linux systems, so Scamp forces X11
 * (XWayland) by default and offers an escape hatch.
 * see docs/notes/linux-wayland-ozone.md
 */
/**
 * Decide the value for `--ozone-platform`, or `null` to append nothing.
 *
 * Pure — no Electron, no process access. Precedence, highest first:
 * an explicit `--ozone-platform` on argv, then `SCAMP_OZONE_PLATFORM`
 * (where `auto` means "let Electron choose"), then the x11 default.
 */
export const resolveOzonePlatform = ({ platform, argv, override, }) => {
    if (platform !== 'linux')
        return null;
    // The user passed the flag themselves — don't fight them, and don't
    // append a duplicate Chromium would have to disambiguate.
    const explicit = argv.some((arg) => arg === '--ozone-platform' || arg.startsWith('--ozone-platform='));
    if (explicit)
        return null;
    const wanted = override?.trim();
    if (wanted !== undefined && wanted !== '') {
        return wanted === 'auto' ? null : wanted;
    }
    return 'x11';
};
