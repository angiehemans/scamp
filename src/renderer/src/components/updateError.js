// Maps a raw electron-updater error message to a concise, user-facing
// line. The auto-updater forwards err.message verbatim over IPC; the
// banner used to discard it and always blame the connection, which
// masked the common macOS case where a downloaded update fails Squirrel's
// code-signature check (e.g. updating over a locally-built / ad-hoc app).
// see docs/notes/auto-update.md
/**
 * Categorise an updater error message for display. Returns a short
 * sentence the banner can show directly. Unknown errors fall through to
 * the raw message so nothing is hidden from the user.
 */
export const describeUpdateError = (raw) => {
    const message = raw.trim();
    const lower = message.toLowerCase();
    // Squirrel.Mac signature validation failure. Most often hit when the
    // currently-installed app is unsigned/ad-hoc (a local `npm run package`
    // build) so a Developer ID-signed update can't satisfy its requirement.
    if (lower.includes('code signature') ||
        lower.includes('code requirement') ||
        lower.includes('did not pass validation') ||
        lower.includes('not signed') ||
        lower.includes('signature')) {
        return "Update couldn't be verified — reinstall Scamp from the latest release on GitHub.";
    }
    // Genuine connectivity / download failures.
    if (/enotfound|etimedout|econnrefused|econnreset|getaddrinfo|enetunreach|eai_again|net::|offline|connection|socket|dns/.test(lower)) {
        return 'Update failed — check your connection.';
    }
    // Fall back to the real message rather than hiding it.
    return message.length > 0 ? `Update failed: ${message}` : 'Update failed.';
};
