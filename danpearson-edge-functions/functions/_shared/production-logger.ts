/**
 * Production-ready structured logging for Supabase Edge Functions
 *
 * Features:
 * - Structured JSON logging for CloudFlare/Supabase integration
 * - Log levels (debug, info, warn, error)
 * - Automatic PII masking
 * - Request correlation IDs
 * - Performance timing
 */

// Log levels with numeric values for filtering
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// PII patterns for masking
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  jwt: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/g,
  apiKey: /\b(?:sk|pk|api|key|secret|token|bearer)[-_]?[A-Za-z0-9]{20,}\b/gi,
  password: /"(?:password|passwd|pwd|secret|credential|auth_token)":\s*"[^"]*"/gi,
};

// Fields that should be completely redacted
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apiKey',
  'auth_token', 'authToken', 'access_token', 'accessToken', 'refresh_token',
  'refreshToken', 'private_key', 'privateKey', 'credit_card', 'creditCard',
  'ssn', 'social_security', 'socialSecurity', 'authorization',
];

/**
 * Mask PII in a string
 */
export function maskPII(value: string): string {
  let masked = value;

  // Mask email addresses
  masked = masked.replace(PII_PATTERNS.email, (match) => {
    const [localPart, domain] = match.split('@');
    const maskedLocal = localPart.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  });

  // Mask phone numbers
  masked = masked.replace(PII_PATTERNS.phone, (match) => {
    const digits = match.replace(/\D/g, '');
    return `***-***-${digits.slice(-4)}`;
  });

  // Mask SSN
  masked = masked.replace(PII_PATTERNS.ssn, '***-**-****');

  // Mask credit cards
  masked = masked.replace(PII_PATTERNS.creditCard, (match) => {
    const digits = match.replace(/\D/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  });

  // Mask IP addresses
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

  // Mask password fields
  masked = masked.replace(PII_PATTERNS.password, '"[FIELD]": "[REDACTED]"');

  return masked;
}

/**
 * Recursively sanitize an object, masking sensitive fields
 */
export function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskPII(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1);
      }
    }
    return sanitized;
  }

  return '[UNSUPPORTED_TYPE]';
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  function_name?: string;
  correlation_id?: string;
  request_id?: string;
  user_id?: string;
  ip_address?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger context
 */
export interface LoggerContext {
  functionName?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  ipAddress?: string;
}

// Global context for the current request
let globalContext: LoggerContext = {};

/**
 * Set request context (call at start of each request)
 */
export function setRequestContext(ctx: LoggerContext): void {
  globalContext = {
    ...ctx,
    correlationId: ctx.correlationId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  };
}

/**
 * Get current request context
 */
export function getRequestContext(): LoggerContext {
  return globalContext;
}

/**
 * Clear request context
 */
export function clearRequestContext(): void {
  globalContext = {};
}

/**
 * Get log level from environment
 */
function getLogLevel(): LogLevel {
  const level = Deno.env.get('LOG_LEVEL')?.toLowerCase() || 'info';
  const levelMap: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
  };
  return levelMap[level] ?? LogLevel.INFO;
}

/**
 * Check if running in production
 */
function isProduction(): boolean {
  return Deno.env.get('DENO_ENV') === 'production' ||
         Deno.env.get('ENV') === 'production' ||
         Deno.env.get('NODE_ENV') === 'production';
}

/**
 * Create log entry
 */
function createLogEntry(
  level: string,
  message: string,
  metadata?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: maskPII(message),
    function_name: globalContext.functionName,
    correlation_id: globalContext.correlationId,
    request_id: globalContext.requestId,
    user_id: globalContext.userId ? maskPII(globalContext.userId) : undefined,
    ip_address: globalContext.ipAddress ? maskPII(globalContext.ipAddress) : undefined,
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
 * Output log entry
 */
function outputLog(level: LogLevel, entry: LogEntry): void {
  const configuredLevel = getLogLevel();
  if (level < configuredLevel) return;

  // Always output structured JSON in Edge Functions for CloudFlare/Supabase logging
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
}

/**
 * Edge Function Logger
 */
export class EdgeFunctionLogger {
  private functionName: string;

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  /**
   * Initialize logger for a request
   */
  initRequest(req: Request): string {
    const correlationId = req.headers.get('x-correlation-id') ||
                         req.headers.get('x-request-id') ||
                         `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    setRequestContext({
      functionName: this.functionName,
      correlationId,
      requestId: correlationId,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || undefined,
    });

    return correlationId;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('debug', message, metadata);
    outputLog(LogLevel.DEBUG, entry);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('info', message, metadata);
    outputLog(LogLevel.INFO, entry);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', message, metadata);
    outputLog(LogLevel.WARN, entry);
  }

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, metadata, errorObj);
    outputLog(LogLevel.ERROR, entry);
  }

  /**
   * Log request completion
   */
  logRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const entry = createLogEntry(
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      `${method} ${path} ${statusCode}`,
      { method, path, status_code: statusCode, duration_ms: durationMs }
    );
    entry.duration_ms = durationMs;
    outputLog(statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO, entry);
  }

  /**
   * Wrap handler with request logging
   */
  wrapHandler(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
    return async (req: Request) => {
      const start = Date.now();
      const correlationId = this.initRequest(req);
      const url = new URL(req.url);

      this.info(`Request started: ${req.method} ${url.pathname}`);

      try {
        const response = await handler(req);
        const duration = Date.now() - start;

        this.logRequest(req.method, url.pathname, response.status, duration);

        // Add correlation ID to response headers
        const headers = new Headers(response.headers);
        headers.set('x-correlation-id', correlationId);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        const duration = Date.now() - start;
        this.error(`Request failed: ${req.method} ${url.pathname}`, error, { duration_ms: duration });

        clearRequestContext();

        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'x-correlation-id': correlationId,
            },
          }
        );
      } finally {
        clearRequestContext();
      }
    };
  }
}

/**
 * Create a logger for an Edge Function
 */
export function createEdgeFunctionLogger(functionName: string): EdgeFunctionLogger {
  return new EdgeFunctionLogger(functionName);
}

/**
 * Simple logging functions for backward compatibility
 */
export const log = {
  debug: (message: string, metadata?: Record<string, unknown>) => {
    const entry = createLogEntry('debug', message, metadata);
    outputLog(LogLevel.DEBUG, entry);
  },
  info: (message: string, metadata?: Record<string, unknown>) => {
    const entry = createLogEntry('info', message, metadata);
    outputLog(LogLevel.INFO, entry);
  },
  warn: (message: string, metadata?: Record<string, unknown>) => {
    const entry = createLogEntry('warn', message, metadata);
    outputLog(LogLevel.WARN, entry);
  },
  error: (message: string, error?: Error | unknown, metadata?: Record<string, unknown>) => {
    const errorObj = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, metadata, errorObj);
    outputLog(LogLevel.ERROR, entry);
  },
};
