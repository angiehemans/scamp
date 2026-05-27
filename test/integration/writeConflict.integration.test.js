import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { checkWriteConflict } from '../../src/main/ipc/fileConflict';
/**
 * Optimistic-concurrency check on `file:write`. See
 * docs/known-issues.md "Concurrent-write race" for the symptom
 * this guards against: an agent writes the page while Scamp's
 * debounced flush is in flight, and Scamp's write clobbers the
 * agent's edit. With expected* set, main reads disk first and
 * refuses when content has drifted.
 */
describe('checkWriteConflict', () => {
    let tmpDir;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scamp-conflict-'));
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    const writePair = async (name, tsx, css) => {
        const tsxPath = path.join(tmpDir, `${name}.tsx`);
        const cssPath = path.join(tmpDir, `${name}.module.css`);
        await fs.writeFile(tsxPath, tsx, 'utf-8');
        await fs.writeFile(cssPath, css, 'utf-8');
        return { tsxPath, cssPath };
    };
    it('returns null when expected matches disk (write should proceed)', async () => {
        const { tsxPath, cssPath } = await writePair('home', 'export default function Home() { return <div/>; }\n', '.root {}\n');
        const result = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: 'export default function Home() { return <div/>; }\n',
            expectedCssContent: '.root {}\n',
        });
        expect(result).toBeNull();
    });
    it('returns the actual disk content when TSX has drifted', async () => {
        const { tsxPath, cssPath } = await writePair('home', 'AGENT-WROTE-THIS\n', '.root {}\n');
        const result = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: 'SCAMP-EXPECTED-THIS\n',
            expectedCssContent: '.root {}\n',
        });
        expect(result).not.toBeNull();
        expect(result.actualTsxContent).toBe('AGENT-WROTE-THIS\n');
        expect(result.actualCssContent).toBe('.root {}\n');
    });
    it('returns the actual disk content when CSS has drifted', async () => {
        const { tsxPath, cssPath } = await writePair('home', 'export default function Home() { return <div/>; }\n', '.root { background: red; }\n');
        const result = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: 'export default function Home() { return <div/>; }\n',
            expectedCssContent: '.root {}\n',
        });
        expect(result).not.toBeNull();
        expect(result.actualCssContent).toContain('background: red');
    });
    it('returns null when both expected fields are omitted (no check)', async () => {
        const { tsxPath, cssPath } = await writePair('home', 'anything\n', 'anything\n');
        const result = await checkWriteConflict({ tsxPath, cssPath });
        expect(result).toBeNull();
    });
    it('returns null when only one expected field is provided (both required)', async () => {
        const { tsxPath, cssPath } = await writePair('home', 'tsx-on-disk\n', 'css-on-disk\n');
        // expectedTsxContent set but expectedCssContent missing → no
        // check. Half-checks would be ambiguous: a caller that only
        // tracks one half could clobber the other.
        const result = await checkWriteConflict({
            tsxPath,
            cssPath,
            expectedTsxContent: 'something-else\n',
        });
        expect(result).toBeNull();
    });
    it('treats missing files as empty strings for the comparison', async () => {
        // No files written. Caller expects "" on both → no conflict.
        const result = await checkWriteConflict({
            tsxPath: path.join(tmpDir, 'never-written.tsx'),
            cssPath: path.join(tmpDir, 'never-written.module.css'),
            expectedTsxContent: '',
            expectedCssContent: '',
        });
        expect(result).toBeNull();
    });
    it('reports the missing-file case as conflict when caller expects content', async () => {
        // File gone but renderer thinks it had content → conflict.
        // Actual disk reads as empty string; expected is non-empty.
        const result = await checkWriteConflict({
            tsxPath: path.join(tmpDir, 'never-written.tsx'),
            cssPath: path.join(tmpDir, 'never-written.module.css'),
            expectedTsxContent: 'previous-content\n',
            expectedCssContent: '',
        });
        expect(result).not.toBeNull();
        expect(result.actualTsxContent).toBe('');
    });
});
