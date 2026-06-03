import { execFileSync } from 'child_process';
import { delimiter } from 'path';

const MARKER = '__SCAMP_PATH__';

/**
 * Merge the login shell's real PATH into process.env.PATH so child
 * spawns (dev server, npm install, terminals) can find node/npm when
 * the app is GUI-launched. No-op on Windows.
 * See docs/notes/packaged-path.md.
 */
export const fixPathFromLoginShell = (): void => {
  if (process.platform === 'win32') return;
  const shell = process.env['SHELL'] || '/bin/zsh';
  try {
    const out = execFileSync(
      shell,
      ['-ilc', `printf '${MARKER}%s${MARKER}' "$PATH"`],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const resolved = out.split(MARKER)[1];
    if (!resolved) return;
    const merged = new Set<string>();
    for (const p of resolved.split(delimiter)) if (p) merged.add(p);
    for (const p of (process.env['PATH'] ?? '').split(delimiter)) if (p) merged.add(p);
    process.env['PATH'] = Array.from(merged).join(delimiter);
  } catch {
    // Shell resolution failed (timeout, exotic shell, sandbox). Leave
    // PATH untouched rather than block startup — spawn may still work.
  }
};
