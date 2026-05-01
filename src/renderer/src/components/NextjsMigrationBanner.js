import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Button } from './controls/Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppLogStore } from '@store/appLogSlice';
import styles from './NextjsMigrationBanner.module.css';
/**
 * Shown above the canvas on legacy-format projects. Offers an opt-in
 * one-click migration to the Next.js App Router layout. Dismissal is
 * persisted per-project (in `scamp.config.json`) by the parent so the
 * banner stays out of the way for users who don't want to migrate.
 */
export const NextjsMigrationBanner = ({ project, onMigrated, onDismiss, }) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const log = useAppLogStore((s) => s.log);
    const handleMigrate = async () => {
        setMigrating(true);
        try {
            const result = await window.scamp.migrateProject({
                projectPath: project.path,
            });
            log('info', `Migrated to Next.js format. Originals saved to ${result.backupPath}.`);
            onMigrated(result.project);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log('error', `Migration failed: ${message}`);
        }
        finally {
            setMigrating(false);
            setShowConfirm(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.banner, role: "status", children: [_jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: "\u2139" }), _jsxs("div", { className: styles.text, children: [_jsx("strong", { className: styles.title, children: "This project uses the legacy file structure" }), _jsxs("span", { className: styles.message, children: ["New Scamp projects use the Next.js App Router layout (", _jsx("code", { children: "app/page.tsx" }), ", ", _jsx("code", { children: "public/assets/" }), ") so they can be opened directly in a Next.js workspace. Migrate when convenient \u2014 your original files are saved to a backup folder you can recover from."] })] })] }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { variant: "primary", size: "sm", onClick: () => setShowConfirm(true), disabled: migrating, children: migrating ? 'Migrating…' : 'Migrate to Next.js format' }), _jsx(Button, { variant: "secondary", size: "sm", onClick: onDismiss, disabled: migrating, children: "Dismiss" })] })] }), showConfirm && (_jsx(ConfirmDialog, { title: `Migrate ${project.name} to Next.js format?`, message: 'Scamp will reorganise this project into the Next.js App Router layout. Your original files will be moved into a sibling backup folder (.scamp-backup-…) inside the project, so nothing is destroyed.', confirmLabel: "Migrate", variant: "primary", onConfirm: () => void handleMigrate(), onCancel: () => setShowConfirm(false) }))] }));
};
