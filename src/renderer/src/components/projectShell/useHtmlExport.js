import { useCallback, useEffect, useRef, useState } from 'react';
import { buildHtmlExport } from '@lib/htmlExport';
import { exportSummary, resetDelayFor, } from '@lib/htmlExportStatus';
import { useAppLogStore } from '@store/appLogSlice';
import { componentKindOf } from '@shared/types';
import { viewSlugFor } from '@shared/templates';
export const useHtmlExport = (projectPath, projectName) => {
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState(null);
    const [location, setLocation] = useState(null);
    const log = useAppLogStore((s) => s.log);
    const resetTimer = useRef(null);
    const clearResetTimer = () => {
        if (resetTimer.current !== null) {
            clearTimeout(resetTimer.current);
            resetTimer.current = null;
        }
    };
    // A pending reset would fire into an unmounted component otherwise.
    useEffect(() => clearResetTimer, []);
    const settle = useCallback((next, text) => {
        setStatus(next);
        setMessage(text);
        clearResetTimer();
        const delay = resetDelayFor(next);
        if (delay === null)
            return;
        resetTimer.current = setTimeout(() => {
            setStatus('idle');
            setMessage(null);
            setLocation(null);
            resetTimer.current = null;
        }, delay);
    }, []);
    const exportHtml = useCallback(async () => {
        if (projectPath.length === 0)
            return;
        const chosen = await window.scamp.chooseHtmlExportFolder();
        if (chosen.canceled || chosen.path === null)
            return;
        clearResetTimer();
        setStatus('exporting');
        setMessage(null);
        setLocation(null);
        try {
            const [project, themeCss] = await Promise.all([
                window.scamp.readProject({ folderPath: projectPath }),
                window.scamp.readTheme({ projectPath }),
            ]);
            // A framework project has no pages: its pages are the views, and
            // the slug is what internal hrefs and the output filenames use.
            // Reading `project.pages` there exported nothing at all.
            // see docs/plans/framework-release-readiness.md
            const isView = (c) => componentKindOf(c) === 'view';
            const scamp = project.format === 'scamp';
            const { files, skipped } = buildHtmlExport({
                projectName,
                pages: scamp
                    ? project.components
                        .filter(isView)
                        .map((c) => ({ ...c, name: viewSlugFor(c.name) }))
                    : project.pages,
                components: scamp ? project.components.filter((c) => !isView(c)) : project.components,
                themeCss,
            });
            const result = await window.scamp.exportHtml({
                parentDir: chosen.path,
                projectPath,
                projectName,
                files,
            });
            if (!result.ok) {
                log('error', result.error);
                settle('error', result.error);
                return;
            }
            for (const skip of skipped) {
                log('warn', `Skipped page "${skip.pageName}": ${skip.reason}`);
            }
            const summary = exportSummary(result.fileCount, result.assetCount);
            log('info', `${summary} to ${result.targetDir}`);
            setLocation(result.targetDir);
            settle('done', summary);
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : 'Failed to export.';
            log('error', reason);
            settle('error', reason);
        }
    }, [projectPath, projectName, log, settle]);
    return { exportHtml, status, message, location };
};
