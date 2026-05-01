import React from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewApp } from './PreviewApp';

window.addEventListener('error', (e) => {
  console.error('[preview] uncaught error:', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[preview] unhandled rejection:', e.reason);
});

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Preview window root element missing.');
}
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
