import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from './controls/Button';
import { SUPPORTED_CONTRACT, isSupportedContract } from '@shared/projectConfig';
import styles from './ParseErrorBanner.module.css';
/**
 * Shown above the canvas of a scamp-format project whose installed
 * `scampjs` is missing or implements a contract this build can't read
 * or write. The app still opens the project; the banner says what to
 * install. Renders nothing when the install is in range.
 * see docs/plans/framework-phase-1-plan.md, step 6
 */
export const FrameworkContractBanner = ({ framework, onDismiss }) => {
    const installed = framework.installedVersion !== null;
    if (installed && isSupportedContract(framework.contract))
        return null;
    const min = SUPPORTED_CONTRACT.min;
    const max = SUPPORTED_CONTRACT.max;
    const range = min === max ? `${max}` : `${min}–${max}`;
    const title = installed
        ? `This project's scampjs uses contract ${framework.contract ?? '?'}`
        : 'scampjs isn’t installed in this project';
    const message = installed
        ? `This version of Scamp supports contract ${range}. Update Scamp, or install a scampjs release that implements contract ${range}, before editing — a save would write the older shape.`
        : `Run npm install in the project folder to get the version its package.json asks for. Scamp can read and edit the files without it, but previews and builds need it.`;
    return (_jsxs("div", { className: styles.banner, role: "status", "data-testid": "framework-contract-banner", children: [_jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.icon, "aria-hidden": "true", children: "\u2139" }), _jsxs("div", { className: styles.text, children: [_jsx("strong", { className: styles.title, children: title }), _jsx("span", { className: styles.message, children: message })] })] }), _jsx("div", { className: styles.dismissWrap, children: _jsx(Button, { variant: "secondary", size: "sm", onClick: onDismiss, children: "Dismiss" }) })] }));
};
