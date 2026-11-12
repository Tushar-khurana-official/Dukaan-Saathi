import {createRoot} from 'react-dom/client';
import Root from './Root';
import './index.css';

createRoot(document.getElementById('root')!).render(<Root />);

// Offline support: cache the app so it opens without signal (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
