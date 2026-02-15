import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress expected/harmless errors that clutter the console
const originalError = console.error;
console.error = (...args: any[]) => {
  const errorMessage = args[0]?.toString() || '';
  const fullMessage = args.join(' ').toLowerCase();
  
  // Suppress 403 errors from Instagram CDN (expected - Instagram blocks direct image access)
  if (
    errorMessage.includes('403') &&
    (errorMessage.includes('scontent') || errorMessage.includes('cdninstagram') || errorMessage.includes('instagram'))
  ) {
    return; // Silently ignore
  }
  
  // Suppress Cross-Origin-Opener-Policy warnings from Firebase Auth (harmless)
  if (
    fullMessage.includes('cross-origin-opener-policy') ||
    fullMessage.includes('window.closed') ||
    (errorMessage.includes('firebase_auth') && fullMessage.includes('policy'))
  ) {
    return; // Silently ignore - this is a known Firebase Auth quirk
  }
  
  // Log all other errors normally
  originalError.apply(console, args);
};

// Suppress network errors for Instagram CDN and Firebase Auth COOP warnings
window.addEventListener('error', (event) => {
  const message = event.message?.toLowerCase() || '';
  const filename = event.filename?.toLowerCase() || '';
  
  // Suppress Instagram CDN 403 errors
  if (
    message.includes('403') &&
    (filename.includes('scontent') || filename.includes('cdninstagram') || filename.includes('instagram'))
  ) {
    event.preventDefault();
    return false;
  }
  
  // Suppress Firebase Auth COOP warnings
  if (
    message.includes('cross-origin-opener-policy') ||
    message.includes('window.closed') ||
    (filename.includes('firebase_auth') && message.includes('policy'))
  ) {
    event.preventDefault();
    return false;
  }
}, true);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
