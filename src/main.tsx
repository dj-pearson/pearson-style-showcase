import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initPerformanceMonitoring } from './lib/performance'

// Initialize performance monitoring for Core Web Vitals
initPerformanceMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
