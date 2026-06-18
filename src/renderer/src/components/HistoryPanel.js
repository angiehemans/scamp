import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { IconArrowBackUp, IconBolt, IconBookmark, IconPlayerPlay, IconPlayerStop, IconRefresh, } from '@tabler/icons-react';
import { useSnapshotsStore } from '@store/snapshotsSlice';
import { formatPageCount, snapshotsNewestFirst, triggerIcon, } from '@store/snapshotDisplay';
import { formatRelativeTime } from '@store/formatHistoryLabel';
import { Tooltip } from './controls/Tooltip';
import { Button } from './controls/Button';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './HistoryPanel.module.css';
const TRIGGER_ICON = {
    'session-open': IconPlayerPlay,
    'session-close': IconPlayerStop,
    agent: IconBolt,
    manual: IconBookmark,
    auto: IconRefresh,
    restore: IconArrowBackUp,
};
/**
 * The History panel — the second tab in the left sidebar. Lists the
 * project's persistent snapshots (newest first) with a "Now" marker for
 * the current state. Clicking a snapshot restores it (after confirming);
 * "Save snapshot" takes a manual one. The in-session Cmd+Z undo stack is
 * independent and unaffected. See docs/notes/snapshots.md.
 */
export const HistoryPanel = ({ projectPath }) => {
    const snapshots = useSnapshotsStore((s) => s.snapshots);
    const loadSnapshots = useSnapshotsStore((s) => s.loadSnapshots);
    const takeSnapshot = useSnapshotsStore((s) => s.takeSnapshot);
    const restoreSnapshot = useSnapshotsStore((s) => s.restoreSnapshot);
    // Refresh the list every time the panel mounts (i.e. the tab is opened)
    // so agent-edit / auto-save snapshots taken while it was hidden appear.
    useEffect(() => {
        void loadSnapshots(projectPath);
    }, [loadSnapshots, projectPath]);
    // 30s tick keeps relative timestamps fresh ("just now" → "1 min ago").
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);
    const now = Date.now();
    // Manual-snapshot naming + restore-confirm state.
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState('');
    const [pendingRestore, setPendingRestore] = useState(null);
    const [restoreError, setRestoreError] = useState(null);
    const handleSaveSnapshot = () => {
        void takeSnapshot(projectPath, 'manual', name.trim() || undefined);
        setName('');
        setNaming(false);
    };
    const handleConfirmRestore = async () => {
        if (!pendingRestore)
            return;
        const res = await restoreSnapshot(projectPath, pendingRestore.id);
        if (res.ok) {
            setPendingRestore(null);
            setRestoreError(null);
        }
        else {
            setRestoreError(res.error);
        }
    };
    const ordered = snapshotsNewestFirst(snapshots);
    return (_jsxs("div", { className: styles.panel, children: [_jsx("div", { className: styles.header, children: naming ? (_jsx("input", { className: styles.nameInput, autoFocus: true, value: name, placeholder: "Snapshot name (optional)", onChange: (e) => setName(e.target.value), onKeyDown: (e) => {
                        if (e.key === 'Enter')
                            handleSaveSnapshot();
                        if (e.key === 'Escape') {
                            setNaming(false);
                            setName('');
                        }
                    }, onBlur: () => {
                        setNaming(false);
                        setName('');
                    } })) : (_jsx(Button, { variant: "secondary", fullWidth: true, onClick: () => setNaming(true), children: "Save snapshot" })) }), _jsxs("ul", { className: styles.list, children: [_jsx("li", { className: `${styles.row} ${styles.nowRow}`, children: _jsxs("div", { className: styles.rowButton, children: [_jsx("span", { className: styles.bullet, "aria-hidden": "true", children: "\u25CF" }), _jsx("span", { className: styles.label, children: "Now" })] }) }), ordered.length === 0 ? (_jsx("li", { children: _jsx("p", { className: styles.empty, children: "No snapshots yet" }) })) : (ordered.map((snap) => (_jsx(SnapshotRow, { snapshot: snap, now: now, onRestore: () => {
                            setRestoreError(null);
                            setPendingRestore(snap);
                        } }, snap.id))))] }), pendingRestore && (_jsx(ConfirmDialog, { title: "Restore this snapshot?", message: `${pendingRestore.label} — ${formatRelativeTime(Date.parse(pendingRestore.timestamp), now)}\n\nThis will replace all current project files with the snapshot. Your current state will be saved as a new snapshot first.`, confirmLabel: "Restore", cancelLabel: "Cancel", variant: "destructive", error: restoreError, onConfirm: () => void handleConfirmRestore(), onCancel: () => {
                    setPendingRestore(null);
                    setRestoreError(null);
                } }))] }));
};
const SnapshotRow = ({ snapshot, now, onRestore }) => {
    const Icon = TRIGGER_ICON[triggerIcon(snapshot.trigger)];
    const ts = Date.parse(snapshot.timestamp);
    const relative = formatRelativeTime(ts, now);
    const absolute = new Date(ts).toLocaleString();
    return (_jsx("li", { className: styles.row, children: _jsx(Tooltip, { label: absolute, children: _jsxs("button", { type: "button", className: styles.rowButton, onClick: onRestore, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: _jsx(Icon, { size: 14, stroke: 2 }) }), _jsxs("span", { className: styles.label, children: [snapshot.label, _jsxs("span", { className: styles.secondary, children: [' · ', formatPageCount(snapshot.pageCount)] })] }), _jsx("span", { className: styles.timestamp, children: relative })] }) }) }));
};
