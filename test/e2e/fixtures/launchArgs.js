import { resolveOzonePlatform } from '../../../src/main/ozone';
/**
 * Extra Electron CLI args every E2E launch needs.
 *
 * The packaged app relaunches itself onto the X11 ozone backend, but
 * Playwright attaches to the process it spawned, so a relaunch would
 * detach it. Pass the flag up front instead.
 * see docs/notes/linux-wayland-ozone.md
 */
const platform = resolveOzonePlatform({
    platform: process.platform,
    argv: process.argv,
    override: process.env['SCAMP_OZONE_PLATFORM'],
});
export const OZONE_ARGS = platform === null ? [] : [`--ozone-platform=${platform}`];
