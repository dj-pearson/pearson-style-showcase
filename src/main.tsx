import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initPerformanceMonitoring } from './lib/performance'
import { registerServiceWorker } from './lib/registerSW'
import { initErrorTracking } from './lib/error-tracking'
import { initErrorAlerting, connectToErrorTracking } from './lib/error-alerting'
import { initGoogleAnalytics } from './lib/analytics'

// Initialize error tracking first to capture any initialization errors
initErrorTracking();

// Initialize error alerting with default thresholds
// Can be customized via environment variables
initErrorAlerting({
  errorRateWarningThreshold: 10,  // 10 errors/min triggers warning
  errorRateCriticalThreshold: 50, // 50 errors/min triggers critical
  cooldownMinutes: 15,            // 15 min between alerts
  enableEmail: true,              // Enable email alerts
  alertEmails: ['admin@danpearson.net'], // Alert recipients
});

// Connect error alerting to error tracking
connectToErrorTracking();

// Initialize performance monitoring for Core Web Vitals
initPerformanceMonitoring();

// Initialize Google Analytics (CSP-compliant, non-blocking)
initGoogleAnalytics();

// Register Service Worker for PWA offline support
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
