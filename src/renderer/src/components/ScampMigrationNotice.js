import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from './controls/Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppLogStore } from '@store/appLogSlice';
import { errorMessage } from '@shared/errorMessage';
import { Section } from './sections/Section';
import styles from './ScampMigrationNotice.module.css';
/**
 * A section of the properties panel on Next.js-format projects, offering
 * the one-click move to the Scamp framework structure: a snapshot, every
 * page converted to a view, then the main process turns wrappers into
 * routes and swaps the Next.js files for the framework's. Dismissal is
 * persisted per project by the parent.
 *
 * A section rather than a banner across the top: the offer is optional
 * and open-ended, and a persistent bar costs every project that hasn't
 * taken it a strip of canvas. see docs/notes/nextjs-sunset.md
 */
export const ScampMigrationNotice = ({ project, convertPages, onMigrated, onDismiss, }) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [error, setError] = useState(null);
    const log = useAppLogStore((s) => s.log);
    const handleMigrate = async () => {
        setMigrating(true);
        setError(null);
        try {
            const snapshot = await window.scamp.createSnapshot({
                projectPath: project.path,
                trigger: 'manual',
                label: 'Before migrating to the Scamp framework',
            });
            if (snapshot.snapshot === null) {
                log('warn', 'No snapshot was taken before the migration; see the main-process log.');
            }
            await convertPages();
            const result = await window.scamp.migrateProject({ projectPath: project.path });
            log('info', `Migrated to the Scamp framework. Next.js files saved to ${result.backupPath}.`);
            for (const file of result.unmovedFiles) {
                log('warn', `Left in place, yours to port: ${file}`);
            }
            onMigrated(result.project);
        }
        catch (err) {
            const message = errorMessage(err);
            log('error', `Migration failed: ${message}`);
            setError(message);
        }
        finally {
            setMigrating(false);
            setShowConfirm(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { "data-testid": "scamp-migration-notice", children: _jsxs(Section, { title: "Scamp framework", collapsible: true, defaultOpen: true, children: [_jsxs("span", { className: styles.message, children: ["This project uses the Next.js layout. On the Scamp framework each page is a view, a route, and the theme in ", _jsx("code", { children: "design/" }), ". Your Next.js files move to a backup folder, and anything Scamp didn't write stays where it is."] }), error !== null && _jsx("span", { className: styles.error, children: error }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "primary", size: "sm", onClick: () => setShowConfirm(true), disabled: migrating, children: migrating ? 'Migrating…' : 'Migrate this project' }), _jsx(Button, { variant: "secondary", size: "sm", onClick: onDismiss, disabled: migrating, children: "Dismiss" })] })] }) }), showConfirm && (_jsx(ConfirmDialog, { title: `Migrate ${project.name} to the Scamp framework?`, message: 'Scamp takes a snapshot, turns each page into a view with a route that renders it, moves the theme under design/, and swaps Next.js for scampjs in package.json. The Next.js files move to a backup folder (.scamp-backup-…) inside the project. API routes and other files Scamp didn’t write stay where they are and are listed afterwards. Run npm install before the first preview.', confirmLabel: "Migrate", variant: "primary", onConfirm: () => void handleMigrate(), onCancel: () => setShowConfirm(false) }))] }));
};
