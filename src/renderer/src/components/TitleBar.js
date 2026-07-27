import { jsx as _jsx } from "react/jsx-runtime";
import styles from './TitleBar.module.css';
/**
 * Themed, draggable title bar that replaces the OS chrome (the window uses
 * `titleBarStyle: 'hidden'`). It draws only the background + centered title
 * in the app font; the native min/max/close buttons (Windows/Linux) or
 * traffic lights (macOS) are drawn by the OS over this strip. The centered
 * title is constrained to the `titlebar-area` so it never sits under those
 * controls. See docs/notes/title-bar.md.
 */
export const TitleBar = () => {
    return (_jsx("div", { className: styles.bar, children: _jsx("span", { className: styles.title, children: "Scamp" }) }));
};
