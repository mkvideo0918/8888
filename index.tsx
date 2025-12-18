
import React from 'react';
import ReactDOM from 'react-dom/client';
// Remove the explicit .tsx extension to prevent resolution issues in some build environments
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("React Render Error:", err);
    rootElement.innerHTML = `<div style="color: white; padding: 20px;">應用啟動失敗: ${err.message}</div>`;
  }
}