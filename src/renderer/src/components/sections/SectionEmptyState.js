import { jsx as _jsx } from "react/jsx-runtime";
import styles from './Section.module.css';
/**
 * The empty-state indicator a list section renders when it has no
 * rows. Uses the shared `.row` / `.rowLabel` classes — note
 * `.rowLabel` is `display: none`, so this is primarily a DOM marker
 * for e2e (`data-testid`) rather than visible chrome. Kept byte-for-
 * byte identical to the inline copies it replaces in Filters /
 * Transitions / Shadows so the consolidation changes nothing visually.
 */
export const SectionEmptyState = ({ testId, children = 'None', }) => (_jsx("div", { className: styles.row, children: _jsx("span", { className: styles.rowLabel, "data-testid": testId, children: children }) }));
