/**
 * One line of `scamp dev --json` (scampjs CONTRACT.md section 2.1) as the
 * app log shows it, or null for a line that isn't one: the readiness
 * line, or Vite's own output.
 */
export const parseDevJsonLine = (line) => {
    if (!line.startsWith('{'))
        return null;
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null)
        return null;
    const entry = parsed;
    if (entry['kind'] === 'request') {
        return {
            level: 'info',
            message: `${String(entry['method'])} ${String(entry['path'])} ${String(entry['status'])} ${String(entry['ms'])}ms`,
        };
    }
    if (entry['kind'] === 'error') {
        return { level: 'error', message: `${String(entry['path'])}: ${String(entry['message'])}` };
    }
    return null;
};
