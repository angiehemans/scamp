import { describe, it, expect } from 'vitest';
import { candidateFolderName, classifyTarget, EXPORT_MARKER, exportFolderName, isSafeRelativePath, } from '../src/main/ipc/htmlExportOps';
describe('isSafeRelativePath', () => {
    it('accepts a plain filename', () => {
        expect(isSafeRelativePath('index.html')).toBe(true);
    });
    it('accepts a nested page path', () => {
        expect(isSafeRelativePath('about/index.html')).toBe(true);
    });
    it('rejects an absolute path', () => {
        expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    });
    it('rejects a parent-directory escape', () => {
        expect(isSafeRelativePath('../outside.html')).toBe(false);
    });
    it('rejects a parent-directory escape buried mid-path', () => {
        expect(isSafeRelativePath('about/../../outside.html')).toBe(false);
    });
    it('rejects a windows drive-letter path', () => {
        expect(isSafeRelativePath('C:\\Windows\\system32')).toBe(false);
    });
    it('rejects a backslash parent escape', () => {
        expect(isSafeRelativePath('..\\outside.html')).toBe(false);
    });
    it('rejects an empty path', () => {
        expect(isSafeRelativePath('')).toBe(false);
    });
    it('rejects a path with an empty segment', () => {
        expect(isSafeRelativePath('about//index.html')).toBe(false);
    });
});
describe('classifyTarget', () => {
    it('treats an empty folder as safe to fill', () => {
        expect(classifyTarget([])).toBe('empty');
    });
    it('recognises a folder it exported into before', () => {
        expect(classifyTarget([EXPORT_MARKER, 'index.html'])).toBe('previous-export');
    });
    it('refuses a folder holding files it did not write', () => {
        // The guard that stops an export from overwriting someone's documents.
        expect(classifyTarget(['taxes.pdf', 'photos'])).toBe('occupied');
    });
    it('ignores a lone .DS_Store, which macOS creates just by looking', () => {
        expect(classifyTarget(['.DS_Store'])).toBe('empty');
    });
});
describe('exportFolderName', () => {
    it('uses the project name as-is when it is already a valid folder name', () => {
        expect(exportFolderName('scamp-ui')).toBe('scamp-ui');
    });
    it('replaces spaces so the folder is comfortable in a url', () => {
        expect(exportFolderName('My Portfolio Site')).toBe('My-Portfolio-Site');
    });
    it('strips characters that are illegal in a filename', () => {
        expect(exportFolderName('a/b:c*d?e"f<g>h|i')).toBe('abcdefghi');
    });
    it('refuses to produce a hidden folder from a leading dot', () => {
        expect(exportFolderName('.hidden')).toBe('hidden');
    });
    it('falls back to a generic name when nothing usable is left', () => {
        expect(exportFolderName('///')).toBe('scamp-export');
        expect(exportFolderName('   ')).toBe('scamp-export');
        expect(exportFolderName('')).toBe('scamp-export');
    });
});
describe('candidateFolderName', () => {
    it('uses the plain name on the first attempt', () => {
        expect(candidateFolderName('site', 1)).toBe('site');
    });
    it('suffixes later attempts so an existing folder is stepped over', () => {
        expect(candidateFolderName('site', 2)).toBe('site-2');
        expect(candidateFolderName('site', 7)).toBe('site-7');
    });
});
