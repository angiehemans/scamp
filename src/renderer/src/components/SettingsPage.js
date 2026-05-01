import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Tooltip } from './controls/Tooltip';
import styles from './SettingsPage.module.css';
export const SettingsPage = ({ onBack }) => {
    const [settings, setSettings] = useState(null);
    const refresh = useCallback(async () => {
        const next = await window.scamp.getSettings();
        setSettings(next);
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    const handlePickFolder = async () => {
        const result = await window.scamp.chooseFolder();
        if (result.canceled || !result.path)
            return;
        const next = await window.scamp.setDefaultProjectsFolder(result.path);
        setSettings(next);
    };
    const handleClearFolder = async () => {
        const next = await window.scamp.setDefaultProjectsFolder(null);
        setSettings(next);
    };
    if (!settings)
        return _jsx("div", { className: styles.page });
    return (_jsxs("div", { className: styles.page, children: [_jsxs("div", { className: styles.header, children: [_jsx("button", { className: styles.backButton, onClick: onBack, type: "button", children: "\u2190 Back" }), _jsx("h1", { className: styles.headerTitle, children: "Settings" })] }), _jsx("div", { className: styles.body, children: _jsxs("div", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "General" }), _jsxs("div", { className: styles.row, children: [_jsx("span", { className: styles.rowLabel, children: "Default folder" }), _jsxs("div", { className: styles.rowControl, children: [settings.defaultProjectsFolder ? (_jsx(Tooltip, { label: settings.defaultProjectsFolder, children: _jsx("span", { className: styles.folderPath, children: settings.defaultProjectsFolder }) })) : (_jsx("span", { className: styles.folderNone, children: "Not set" })), _jsx("button", { className: styles.smallButton, onClick: handlePickFolder, type: "button", children: settings.defaultProjectsFolder ? 'Change' : 'Choose' }), settings.defaultProjectsFolder && (_jsx("button", { className: styles.smallButton, onClick: handleClearFolder, type: "button", children: "Clear" }))] })] })] }) })] }));
};
