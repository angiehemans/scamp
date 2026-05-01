import { jsx as _jsx } from "react/jsx-runtime";
import styles from './DrawPreview.module.css';
export const DrawPreview = ({ x, y, width, height }) => {
    return (_jsx("div", { className: styles.preview, style: { left: x, top: y, width, height } }));
};
