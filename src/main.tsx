import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initPerformanceMonitoring } from './lib/performance'
import { registerServiceWorker, setupInstallPrompt } from './lib/registerSW'

// Initialize performance monitoring for Core Web Vitals
initPerformanceMonitoring();

// Register Service Worker for PWA offline support
registerServiceWorker();

// Setup PWA install prompt
setupInstallPrompt();

createRoot(document.getElementById("root")!).render(<App />);
