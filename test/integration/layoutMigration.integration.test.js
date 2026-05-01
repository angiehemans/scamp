import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { refreshLayoutTemplateIfNeeded } from '../../src/main/ipc/projectScaffold';
import { defaultLayoutTsx, LEGACY_LAYOUT_TEMPLATES, } from '../../src/shared/agentMd';
describe('refreshLayoutTemplateIfNeeded', () => {
    let projectDir;
    let appDir;
    let layoutPath;
    beforeEach(async () => {
        projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-layoutmig-'));
        // basename of the temp dir is the "project name" the migration
        // uses to render the latest template — we don't control the exact
        // string so we name the file after `basename(projectDir)`.
        appDir = path.join(projectDir, 'app');
        await fs.mkdir(appDir);
        layoutPath = path.join(appDir, 'layout.tsx');
    });
    afterEach(async () => {
        await fs.rm(projectDir, { recursive: true, force: true });
    });
    it('replaces a legacy layout file with the latest template', async () => {
        const projectName = path.basename(projectDir);
        const legacy = LEGACY_LAYOUT_TEMPLATES(projectName)[0];
        await fs.writeFile(layoutPath, legacy, 'utf-8');
        await refreshLayoutTemplateIfNeeded(projectDir);
        const after = await fs.readFile(layoutPath, 'utf-8');
        expect(after).toBe(defaultLayoutTsx(projectName));
        expect(after).toContain("<body style={{ margin: 0, minHeight: '100vh' }}>{children}</body>");
    });
    it('is a no-op when the file already matches the latest template', async () => {
        const projectName = path.basename(projectDir);
        const latest = defaultLayoutTsx(projectName);
        await fs.writeFile(layoutPath, latest, 'utf-8');
        const beforeMtime = (await fs.stat(layoutPath)).mtimeMs;
        // Pause briefly so an unintended write would change mtime
        // measurably across filesystems with second-resolution timestamps.
        await new Promise((r) => setTimeout(r, 20));
        await refreshLayoutTemplateIfNeeded(projectDir);
        const afterMtime = (await fs.stat(layoutPath)).mtimeMs;
        expect(afterMtime).toBe(beforeMtime);
    });
    it('leaves a customised layout file alone (warn-only, no rewrite)', async () => {
        const customised = `// my custom layout
import './my-other-import.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`;
        await fs.writeFile(layoutPath, customised, 'utf-8');
        // Sanity-check the decision: the decision function should
        // classify this as customised. The IO wrapper logs a hint to
        // stderr but doesn't touch the file — the testable contract is
        // "file is unchanged."
        const { decideLayoutMigration } = await import('../../src/shared/layoutMigration');
        expect(decideLayoutMigration(customised, path.basename(projectDir)).kind).toBe('warn');
        await refreshLayoutTemplateIfNeeded(projectDir);
        const after = await fs.readFile(layoutPath, 'utf-8');
        expect(after).toBe(customised);
    });
    it('does nothing (and does not throw) when there is no layout.tsx', async () => {
        // No file written. Calling refresh should silently return.
        await expect(refreshLayoutTemplateIfNeeded(projectDir)).resolves.toBeUndefined();
    });
});
