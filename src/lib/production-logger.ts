/**
 * Production-ready structured logging system
 *
 * Features:
 * - Structured JSON logging for CloudFlare integration
 * - Log levels (debug, info, warn, error)
 * - Automatic PII masking
 * - Request correlation IDs
 * - Performance timing
 * - Context enrichment
 */

// Log levels with numeric values for filtering
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Log level string to enum mapping
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

// Get configured log level from environment
function getConfiguredLogLevel(): LogLevel {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const level = import.meta.env.VITE_LOG_LEVEL?.toLowerCase() || 'info';
    return LOG_LEVEL_MAP[level] ?? LogLevel.INFO;
  }
  return LogLevel.INFO;
}

// Check if running in production
function isProduction(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.PROD === true;
  }
  return false;
}

// PII patterns for masking
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,

  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,

  // SSN
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

  // Credit card numbers
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // IP addresses (IPv4)
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // JWT tokens
  jwt: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g,

  // API keys (common patterns)
  apiKey: /\b(?:sk|pk|api|key|secret|token|bearer)[-_]?[A-Za-z0-9]{20,}\b/gi,

  // UUIDs (might contain user IDs)
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,

  // Password fields in objects
  password: /"(?:password|passwd|pwd|secret|credential|auth_token)":\s*"[^"]*"/gi,
};

// Fields that should be completely redacted
const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'api-key',
  'auth_token',
  'authToken',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'private_key',
  'privateKey',
  'credit_card',
  'creditCard',
  'ssn',
  'social_security',
  'socialSecurity',
];

/**
 * Mask PII in a string
 */
export function maskPII(value: string): string {
  let masked = value;

  // Mask email addresses (show first 2 chars and domain)
  masked = masked.replace(PII_PATTERNS.email, (match) => {
    const [localPart, domain] = match.split('@');
    const maskedLocal = localPart.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  });

  // Mask phone numbers (show last 4 digits)
  masked = masked.replace(PII_PATTERNS.phone, (match) => {
    const digits = match.replace(/\D/g, '');
    return `***-***-${digits.slice(-4)}`;
  });

  // Mask SSN completely
  masked = masked.replace(PII_PATTERNS.ssn, '***-**-****');

  // Mask credit cards (show last 4)
  masked = masked.replace(PII_PATTERNS.creditCard, (match) => {
    const digits = match.replace(/\D/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  });

  // Mask IP addresses (show first octet)
  masked = masked.replace(PII_PATTERNS.ipv4, (match) => {
    const firstOctet = match.split('.')[0];
    return `${firstOctet}.***.***.**`;
  });

  // Mask JWT tokens
  masked = masked.replace(PII_PATTERNS.jwt, '[JWT_REDACTED]');

  // Mask API keys
  masked = masked.replace(PII_PATTERNS.apiKey, (match) => {
    const prefix = match.substring(0, 6);
    return `${prefix}***[REDACTED]`;
  });

  // Mask password fields in JSON-like strings
  masked = masked.replace(PII_PATTERNS.password, '"[FIELD]": "[REDACTED]"');

  return masked;
}

/**
 * Recursively sanitize an object, masking sensitive fields
 */
export function sanitizeObject(obj: unknown, depth = 0): unknown {
  // Prevent deep recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return maskPII(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if this is a sensitive field
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }

    return sanitized;
  }

  // For functions, symbols, etc.
  return '[UNSUPPORTED_TYPE]';
}

/**
 * Log entry structure for CloudFlare and monitoring tools
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  component?: string;
  userId?: string;
  requestId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger context for correlation and enrichment
 */
export interface LoggerContext {
  correlationId?: string;
  component?: string;
  userId?: string;
  requestId?: string;
}

// Generate a correlation ID
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Global correlation ID for the current request/session
let globalCorrelationId: string | null = null;

/**
 * Set global correlation ID (call at start of request/page)
 */
export function setCorrelationId(id?: string): string {
  globalCorrelationId = id || generateCorrelationId();
  return globalCorrelationId;
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string | null {
  return globalCorrelationId;
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: string,
  message: string,
  context?: LoggerContext,
  metadata?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: maskPII(message),
    correlationId: context?.correlationId || globalCorrelationId || undefined,
    component: context?.component,
    userId: context?.userId ? maskPII(context.userId) : undefined,
    requestId: context?.requestId,
  };

  if (metadata) {
    entry.metadata = sanitizeObject(metadata) as Record<string, unknown>;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: maskPII(error.message),
      stack: isProduction() ? undefined : error.stack,
    };
  }

  return entry;
}

/**
 * Output log entry based on environment
 */
function outputLog(level: LogLevel, entry: LogEntry): void {
  const configuredLevel = getConfiguredLogLevel();

  // Skip if below configured level
  if (level < configuredLevel) {
    return;
  }

  if (isProduction()) {
    // Production: Output structured JSON for CloudFlare logging
    const jsonLog = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(jsonLog);
        break;
      case LogLevel.WARN:
        console.warn(jsonLog);
        break;
      case LogLevel.DEBUG:
        console.debug(jsonLog);
        break;
      default:
        console.log(jsonLog);
    }
  } else {
    // Development: Pretty print for readability
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const component = entry.component ? `[${entry.component}]` : '';
    const correlationId = entry.correlationId ? `[${entry.correlationId}]` : '';

    const formattedMessage = `${prefix}${component}${correlationId} ${entry.message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, entry.metadata || '', entry.error || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, entry.metadata || '');
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage, entry.metadata || '');
        break;
      default:
        console.log(formattedMessage, entry.metadata || '');
    }
  }
}

/**
 * Production Logger class with fluent API
 */
export class ProductionLogger {
  private context: LoggerContext;

  constructor(context?: LoggerContext) {
    this.context = context || {};
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LoggerContext>): ProductionLogger {
    return new ProductionLogger({
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('debug', message, this.context, metadata);
    outputLog(LogLevel.DEBUG, entry);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('info', message, this.context, metadata);
    outputLog(LogLevel.INFO, entry);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', message, this.context, metadata);
    outputLog(LogLevel.WARN, entry);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, this.context, metadata, errorObj);
    outputLog(LogLevel.ERROR, entry);
  }

  /**
   * Log with timing (for performance monitoring)
   */
  timed<T>(operation: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.info(`${operation} completed`, { duration: Math.round(duration) });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${operation} failed`, error, { duration: Math.round(duration) });
      throw error;
    }
  }

  /**
   * Log async operation with timing
   */
  async timedAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.info(`${operation} completed`, { duration: Math.round(duration) });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${operation} failed`, error, { duration: Math.round(duration) });
      throw error;
    }
  }
}

// Default logger instance
export const productionLogger = new ProductionLogger();

/**
 * Create a component-specific logger
 */
export function createLogger(component: string): ProductionLogger {
  return new ProductionLogger({ component });
}

/**
 * Request logging middleware helper
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const logger = createLogger('http');
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  const message = `${method} ${path} ${statusCode}`;
  const enrichedMetadata = {
    ...metadata,
    method,
    path,
    statusCode,
    duration: Math.round(duration),
  };

  switch (level) {
    case 'error':
      logger.error(message, undefined, enrichedMetadata);
      break;
    case 'warn':
      logger.warn(message, enrichedMetadata);
      break;
    default:
      logger.info(message, enrichedMetadata);
  }
}

// Export for backward compatibility with existing logger
export const logger = {
  log: (message: string, ...args: unknown[]) => productionLogger.info(message, args.length ? { args: args } : undefined),
  info: (message: string, ...args: unknown[]) => productionLogger.info(message, args.length ? { args: args } : undefined),
  warn: (message: string, ...args: unknown[]) => productionLogger.warn(message, args.length ? { args: args } : undefined),
  error: (message: string, ...args: unknown[]) => {
    const error = args.find(arg => arg instanceof Error);
    const metadata = args.filter(arg => !(arg instanceof Error));
    productionLogger.error(message, error, metadata.length ? { args: metadata } : undefined);
  },
  debug: (message: string, ...args: unknown[]) => productionLogger.debug(message, args.length ? { args: args } : undefined),
};
