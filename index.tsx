
import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: Corrected module import paths to be relative. The reported errors were likely due to missing files.
import App from './App';
import { AppProvider } from './services/appState';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);