import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from './controls/Button';
import styles from './MigrationBanner.module.css';
/**
 * One-time notice shown when the project's root CSS was detected in
 * the legacy fixed-pixel format and migrated to the new
 * `width: 100%; height: auto` defaults. Displayed above the canvas;
 * the user dismisses it explicitly and it never reappears for this
 * project.
 */
export const MigrationBanner = ({ onDismiss }) => {
    return (_jsxs("div", { className: styles.banner, role: "status", children: [_jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: "\u2139" }), _jsxs("div", { className: styles.text, children: [_jsx("strong", { className: styles.title, children: "Canvas size moved out of your CSS" }), _jsxs("span", { className: styles.message, children: ["Scamp no longer writes ", _jsx("code", { children: "width" }), " / ", _jsx("code", { children: "min-height" }), ' ', "on the root. The canvas width now lives in the toolbar, and the root defaults to ", _jsx("code", { children: "width: 100%" }), " so your exported code works anywhere. Adjust the canvas from the new size control in the toolbar."] })] })] }), _jsx("div", { className: styles.dismissWrap, children: _jsx(Button, { variant: "secondary", size: "sm", onClick: onDismiss, children: "Got it" }) })] }));
};
