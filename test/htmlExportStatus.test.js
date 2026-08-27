import { describe, it, expect } from 'vitest';
import { DONE_VISIBLE_MS, ERROR_VISIBLE_MS, exportButtonLabel, exportButtonTooltip, exportSummary, resetDelayFor, } from '@lib/htmlExportStatus';
describe('exportButtonLabel', () => {
    it('names the action when idle', () => {
        expect(exportButtonLabel('idle')).toBe('Export HTML');
    });
    it('says it is working while exporting', () => {
        expect(exportButtonLabel('exporting')).toBe('Exporting…');
    });
    it('shows the summary on success, so the result is visible on the button', () => {
        expect(exportButtonLabel('done', 'Exported 5 files')).toBe('Exported 5 files');
    });
    it('falls back to a generic success label with no summary', () => {
        expect(exportButtonLabel('done')).toBe('Exported');
        expect(exportButtonLabel('done', '')).toBe('Exported');
    });
    it('says plainly that it failed', () => {
        // The failure that motivated this: a silent error looked exactly like
        // a silent success.
        expect(exportButtonLabel('error')).toBe('Export failed');
    });
    it('does not put the failure reason on the button, where it would not fit', () => {
        expect(exportButtonLabel('error', 'EACCES: permission denied, mkdir …')).toBe('Export failed');
    });
});
describe('exportButtonTooltip', () => {
    it('explains the action when idle', () => {
        expect(exportButtonTooltip('idle')).toContain('HTML and CSS');
    });
    it('carries the failure reason, which the label has no room for', () => {
        expect(exportButtonTooltip('error', 'EACCES: permission denied')).toBe('EACCES: permission denied');
    });
    it('still explains a failure with no reason attached', () => {
        expect(exportButtonTooltip('error')).toContain('failed');
        expect(exportButtonTooltip('error', '')).toContain('failed');
    });
    it('confirms where the output went on success', () => {
        expect(exportButtonTooltip('done', 'Exported 5 files')).toBe('Exported 5 files');
        expect(exportButtonTooltip('done')).toContain('folder');
    });
    it('reports progress while exporting', () => {
        expect(exportButtonTooltip('exporting')).toContain('Writing');
    });
});
describe('resetDelayFor', () => {
    it('clears a success after a short while', () => {
        expect(resetDelayFor('done')).toBe(DONE_VISIBLE_MS);
    });
    it('leaves a failure up longer, since it is the only place the reason shows', () => {
        expect(resetDelayFor('error')).toBe(ERROR_VISIBLE_MS);
        expect(ERROR_VISIBLE_MS).toBeGreaterThan(DONE_VISIBLE_MS);
    });
    it('never auto-clears the working state — only finishing ends it', () => {
        expect(resetDelayFor('exporting')).toBeNull();
    });
    it('has nothing to clear when idle', () => {
        expect(resetDelayFor('idle')).toBeNull();
    });
});
describe('exportSummary', () => {
    it('counts files and images', () => {
        expect(exportSummary(12, 3)).toBe('Exported 12 files, 3 images');
    });
    it('omits images when the project has none', () => {
        expect(exportSummary(3, 0)).toBe('Exported 3 files');
    });
    it('uses the singular for one of each', () => {
        expect(exportSummary(1, 1)).toBe('Exported 1 file, 1 image');
    });
    it('treats a negative asset count as none rather than printing it', () => {
        expect(exportSummary(3, -1)).toBe('Exported 3 files');
    });
});
