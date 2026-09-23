import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImportApp } from './ImportApp';
window.addEventListener('error', (e) => {
    console.error('[import] uncaught error:', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[import] unhandled rejection:', e.reason);
});
const container = document.getElementById('root');
if (container === null) {
    throw new Error('Import window root element missing.');
}
createRoot(container).render(_jsx(React.StrictMode, { children: _jsx(ImportApp, {}) }));
