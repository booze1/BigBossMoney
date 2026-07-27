import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { GameProvider } from './store';
import './styles.css';

// Register the generated service worker so a cold offline load works. Dev
// builds skip it — a stale precache would mask every hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // An unregistrable worker only costs offline support; the game still runs.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>,
);
