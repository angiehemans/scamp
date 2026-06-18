import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from './controls/Button';
import styles from './ParseErrorBanner.module.css';
/**
 * Shown above the canvas when `parseCode` throws on the active page or
 * component — usually because an agent or hand-edit left the file in a
 * transiently invalid state mid-write. The canvas keeps showing the
 * last successfully-parsed state instead of silently blanking. Cleared
 * by re-selecting the target (a clean parse) or by dismissing.
 */
export const ParseErrorBanner = ({ targetName, onDismiss }) => {
    return (_jsxs("div", { className: styles.banner, role: "alert", children: [_jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: "\u26A0" }), _jsxs("div", { className: styles.text, children: [_jsxs("strong", { className: styles.title, children: ["Couldn\u2019t parse \u201C", targetName, "\u201D"] }), _jsx("span", { className: styles.message, children: "The canvas is showing the last version that loaded cleanly. Fix the file\u2019s syntax, then re-select it to continue editing. See the activity log for the error." })] })] }), _jsx("div", { className: styles.dismissWrap, children: _jsx(Button, { variant: "secondary", size: "sm", onClick: onDismiss, children: "Dismiss" }) })] }));
};
