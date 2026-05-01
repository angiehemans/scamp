import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// `theme.css` must come first — it declares the `--*` variables that
// global.css and every module CSS reference.
import './styles/theme.css';
import './styles/global.css';
// Catch unhandled errors/rejections so the renderer doesn't crash
// silently during external file edits or other async work.
window.addEventListener('error', (e) => {
    console.error('[renderer] uncaught error:', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[renderer] unhandled rejection:', e.reason);
});
const container = document.getElementById('root');
if (!container)
    throw new Error('Root container missing');
createRoot(container).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
