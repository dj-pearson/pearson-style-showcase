/**
 * Error Alerting Service
 *
 * Provides configurable alerting for error rate spikes and critical failures.
 *
 * Features:
 * - Error rate monitoring with sliding window
 * - Alert thresholds (warning, critical)
 * - Alert cooldown to prevent spam
 * - Multiple notification channels (email, webhook, console)
 * - Integration with error tracking service
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Alert severity levels
export type AlertSeverity = 'warning' | 'critical' | 'resolved';

// Alert configuration
export interface AlertConfig {
  errorRateWarningThreshold: number;  // Errors per minute to trigger warning
  errorRateCriticalThreshold: number; // Errors per minute to trigger critical
  cooldownMinutes: number;            // Minutes between alerts
  windowMinutes: number;              // Sliding window for rate calculation
  enableEmail: boolean;               // Send email alerts
  enableWebhook: boolean;             // Send webhook alerts
  webhookUrl?: string;                // Webhook endpoint
  alertEmails?: string[];             // Email recipients
}

// Default configuration
const DEFAULT_CONFIG: AlertConfig = {
  errorRateWarningThreshold: 10,
  errorRateCriticalThreshold: 50,
  cooldownMinutes: 15,
  windowMinutes: 5,
  enableEmail: true,
  enableWebhook: false,
};

// Alert state
interface AlertState {
  currentSeverity: AlertSeverity | null;
  lastAlertTime: number;
  errorCounts: Array<{ timestamp: number; count: number }>;
  totalErrors: number;
  alertsTriggered: number;
}

// Global state
let config: AlertConfig = { ...DEFAULT_CONFIG };
let state: AlertState = {
  currentSeverity: null,
  lastAlertTime: 0,
  errorCounts: [],
  totalErrors: 0,
  alertsTriggered: 0,
};

// Check if in production
const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.PROD === true;

/**
 * Initialize the error alerting service
 */
export function initErrorAlerting(customConfig?: Partial<AlertConfig>): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };

  logger.info('[ErrorAlerting] Initialized', {
    warningThreshold: config.errorRateWarningThreshold,
    criticalThreshold: config.errorRateCriticalThreshold,
    cooldownMinutes: config.cooldownMinutes,
  });

  // Set up periodic cleanup
  setInterval(cleanupOldCounts, 60 * 1000); // Every minute
}

/**
 * Clean up old error counts outside the window
 */
function cleanupOldCounts(): void {
  const cutoff = Date.now() - (config.windowMinutes * 60 * 1000);
  state.errorCounts = state.errorCounts.filter(ec => ec.timestamp > cutoff);
}

/**
 * Calculate current error rate (errors per minute)
 */
function calculateErrorRate(): number {
  const now = Date.now();
  const windowStart = now - (config.windowMinutes * 60 * 1000);

  // Count errors in window
  const errorsInWindow = state.errorCounts
    .filter(ec => ec.timestamp > windowStart)
    .reduce((sum, ec) => sum + ec.count, 0);

  // Calculate rate per minute
  return errorsInWindow / config.windowMinutes;
}

/**
 * Determine alert severity based on error rate
 */
function determineSeverity(errorRate: number): AlertSeverity | null {
  if (errorRate >= config.errorRateCriticalThreshold) {
    return 'critical';
  }
  if (errorRate >= config.errorRateWarningThreshold) {
    return 'warning';
  }
  return null;
}

/**
 * Check if alert is on cooldown
 */
function isOnCooldown(): boolean {
  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  return Date.now() - state.lastAlertTime < cooldownMs;
}

/**
 * Record an error occurrence
 */
export function recordError(count: number = 1): void {
  const now = Date.now();

  // Add to counts
  state.errorCounts.push({ timestamp: now, count });
  state.totalErrors += count;

  // Check if we need to alert
  checkAndAlert();
}

/**
 * Check error rate and trigger alerts if needed
 */
function checkAndAlert(): void {
  const errorRate = calculateErrorRate();
  const newSeverity = determineSeverity(errorRate);
  const previousSeverity = state.currentSeverity;

  // Check for severity escalation or initial alert
  const shouldAlert = (
    newSeverity !== null &&
    !isOnCooldown() &&
    (previousSeverity === null || severityOrder(newSeverity) > severityOrder(previousSeverity))
  );

  // Check for resolution
  const isResolved = previousSeverity !== null && newSeverity === null;

  if (shouldAlert && newSeverity) {
    triggerAlert(newSeverity, errorRate);
    state.currentSeverity = newSeverity;
    state.lastAlertTime = Date.now();
    state.alertsTriggered++;
  } else if (isResolved && !isOnCooldown()) {
    triggerAlert('resolved', errorRate);
    state.currentSeverity = null;
    state.lastAlertTime = Date.now();
  }
}

/**
 * Get severity order for comparison
 */
function severityOrder(severity: AlertSeverity): number {
  switch (severity) {
    case 'resolved': return 0;
    case 'warning': return 1;
    case 'critical': return 2;
    default: return -1;
  }
}

/**
 * Trigger an alert
 */
async function triggerAlert(severity: AlertSeverity, errorRate: number): Promise<void> {
  const alert = createAlertPayload(severity, errorRate);

  logger.warn(`[ErrorAlerting] ${severity.toUpperCase()} alert triggered`, {
    errorRate: errorRate.toFixed(2),
    totalErrors: state.totalErrors,
  });

  // Send to configured channels
  const promises: Promise<void>[] = [];

  if (config.enableEmail && config.alertEmails?.length) {
    promises.push(sendEmailAlert(alert));
  }

  if (config.enableWebhook && config.webhookUrl) {
    promises.push(sendWebhookAlert(alert));
  }

  // Log to database
  promises.push(logAlertToDatabase(alert));

  // Console alert (always)
  consoleAlert(alert);

  // Wait for all channels
  await Promise.allSettled(promises);
}

/**
 * Create alert payload
 */
interface AlertPayload {
  severity: AlertSeverity;
  timestamp: string;
  errorRate: number;
  totalErrors: number;
  message: string;
  context: {
    windowMinutes: number;
    thresholdWarning: number;
    thresholdCritical: number;
    url: string;
    environment: string;
  };
}

function createAlertPayload(severity: AlertSeverity, errorRate: number): AlertPayload {
  const messages = {
    warning: `Warning: Error rate elevated to ${errorRate.toFixed(2)}/min`,
    critical: `CRITICAL: Error rate spike detected - ${errorRate.toFixed(2)}/min`,
    resolved: `Resolved: Error rate returned to normal (${errorRate.toFixed(2)}/min)`,
  };

  return {
    severity,
    timestamp: new Date().toISOString(),
    errorRate,
    totalErrors: state.totalErrors,
    message: messages[severity],
    context: {
      windowMinutes: config.windowMinutes,
      thresholdWarning: config.errorRateWarningThreshold,
      thresholdCritical: config.errorRateCriticalThreshold,
      url: typeof window !== 'undefined' ? window.location.origin : 'server',
      environment: isProduction ? 'production' : 'development',
    },
  };
}

/**
 * Send email alert via edge function
 */
async function sendEmailAlert(alert: AlertPayload): Promise<void> {
  if (!config.alertEmails?.length) return;

  try {
    const { error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        type: 'error_alert',
        severity: alert.severity,
        subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
        message: formatEmailBody(alert),
        notification_emails: config.alertEmails,
      },
    });

    if (error) {
      logger.error('[ErrorAlerting] Failed to send email alert', { error: error.message });
    }
  } catch (err) {
    logger.error('[ErrorAlerting] Email alert error', { error: err });
  }
}

/**
 * Format email body
 */
function formatEmailBody(alert: AlertPayload): string {
  return `
Error Alert - ${alert.severity.toUpperCase()}

Time: ${alert.timestamp}
Error Rate: ${alert.errorRate.toFixed(2)} errors/minute
Total Errors: ${alert.totalErrors}

Context:
- Window: ${alert.context.windowMinutes} minutes
- Warning Threshold: ${alert.context.thresholdWarning}/min
- Critical Threshold: ${alert.context.thresholdCritical}/min
- Environment: ${alert.context.environment}
- Origin: ${alert.context.url}

${alert.message}

---
This is an automated alert from the Error Alerting Service.
  `.trim();
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(alert: AlertPayload): Promise<void> {
  if (!config.webhookUrl) return;

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...alert,
        source: 'error-alerting',
        version: '1.0',
      }),
    });

    if (!response.ok) {
      logger.error('[ErrorAlerting] Webhook alert failed', {
        status: response.status,
      });
    }
  } catch (err) {
    logger.error('[ErrorAlerting] Webhook error', { error: err });
  }
}

/**
 * Log alert to database
 */
async function logAlertToDatabase(alert: AlertPayload): Promise<void> {
  try {
    await supabase.from('security_events').insert({
      event_type: 'error_alert',
      metadata: {
        severity: alert.severity,
        error_rate: alert.errorRate,
        total_errors: alert.totalErrors,
        message: alert.message,
        context: alert.context,
      },
      created_at: alert.timestamp,
    });
  } catch (err) {
    logger.error('[ErrorAlerting] Failed to log alert to database', { error: err });
  }
}

/**
 * Console alert (visual emphasis)
 */
function consoleAlert(alert: AlertPayload): void {
  const colors = {
    warning: '\x1b[33m', // Yellow
    critical: '\x1b[31m', // Red
    resolved: '\x1b[32m', // Green
  };
  const reset = '\x1b[0m';
  const color = colors[alert.severity];

  if (isProduction) {
    console.error(JSON.stringify({
      type: 'ERROR_ALERT',
      ...alert,
    }));
  } else {
    console.error(`${color}
╔══════════════════════════════════════════════════════════════╗
║  ERROR ALERT: ${alert.severity.toUpperCase().padEnd(46)}║
╠══════════════════════════════════════════════════════════════╣
║  ${alert.message.padEnd(60)}║
║  Error Rate: ${alert.errorRate.toFixed(2).padEnd(47)}/min ║
║  Total Errors: ${String(alert.totalErrors).padEnd(46)}║
║  Time: ${alert.timestamp.padEnd(53)}║
╚══════════════════════════════════════════════════════════════╝
${reset}`);
  }
}

/**
 * Get current alert status
 */
export function getAlertStatus(): {
  currentSeverity: AlertSeverity | null;
  errorRate: number;
  totalErrors: number;
  alertsTriggered: number;
  isOnCooldown: boolean;
  cooldownRemaining: number;
} {
  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  const timeSinceLastAlert = Date.now() - state.lastAlertTime;
  const cooldownRemaining = Math.max(0, cooldownMs - timeSinceLastAlert);

  return {
    currentSeverity: state.currentSeverity,
    errorRate: calculateErrorRate(),
    totalErrors: state.totalErrors,
    alertsTriggered: state.alertsTriggered,
    isOnCooldown: isOnCooldown(),
    cooldownRemaining: Math.ceil(cooldownRemaining / 1000), // Seconds
  };
}

/**
 * Update alerting configuration
 */
export function updateAlertConfig(updates: Partial<AlertConfig>): void {
  config = { ...config, ...updates };
  logger.info('[ErrorAlerting] Configuration updated', updates);
}

/**
 * Reset alert state (for testing)
 */
export function resetAlertState(): void {
  state = {
    currentSeverity: null,
    lastAlertTime: 0,
    errorCounts: [],
    totalErrors: 0,
    alertsTriggered: 0,
  };
}

/**
 * Manual alert trigger (for testing or manual alerts)
 */
export async function triggerManualAlert(
  severity: AlertSeverity,
  message: string
): Promise<void> {
  const alert: AlertPayload = {
    severity,
    timestamp: new Date().toISOString(),
    errorRate: calculateErrorRate(),
    totalErrors: state.totalErrors,
    message,
    context: {
      windowMinutes: config.windowMinutes,
      thresholdWarning: config.errorRateWarningThreshold,
      thresholdCritical: config.errorRateCriticalThreshold,
      url: typeof window !== 'undefined' ? window.location.origin : 'server',
      environment: isProduction ? 'production' : 'development',
    },
  };

  state.alertsTriggered++;

  // Send to all channels
  await Promise.allSettled([
    config.enableEmail && config.alertEmails?.length ? sendEmailAlert(alert) : Promise.resolve(),
    config.enableWebhook && config.webhookUrl ? sendWebhookAlert(alert) : Promise.resolve(),
    logAlertToDatabase(alert),
  ]);

  consoleAlert(alert);
}

// Integration with error tracking
export function connectToErrorTracking(): void {
  // Hook into the error tracking service to automatically record errors
  if (typeof window !== 'undefined') {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      // Record the error
      recordError(1);
      // Call original
      originalConsoleError.apply(console, args);
    };
  }
}
