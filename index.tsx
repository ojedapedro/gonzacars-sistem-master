
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide the splash loader after React mounts
if (typeof window.__hideLoader === 'function') {
  window.__hideLoader();
}

// TypeScript augmentation for the global loader function
declare global {
  interface Window {
    __hideLoader?: () => void;
  }
}
