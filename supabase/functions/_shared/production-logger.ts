/**
 * Production-ready structured logging for Supabase Edge Functions
 *
 * One JSON line per entry, PII masked, filtered by LOG_LEVEL.
 *
 * Every function runs inside one shared Deno process (danpearson-edge-functions/
 * server.ts), so request context lives on the logger instance, never in module
 * state: a module-level "current request" would be overwritten by whichever
 * concurrent request started last. Get a per-request logger with
 * `createEdgeFunctionLogger('fn-name').forRequest(req)`; it picks up the
 * x-request-id header the server stamps on every request, so function log
 * lines join up with the server's access line.
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
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apiKey',
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
  'authorization',
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
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
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
  request_id?: string;
  user_id?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Logger context, bound to one logger instance.
 */
export interface LoggerContext {
  functionName?: string;
  requestId?: string;
  userId?: string;
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
  return (
    Deno.env.get('DENO_ENV') === 'production' ||
    Deno.env.get('ENV') === 'production' ||
    Deno.env.get('NODE_ENV') === 'production'
  );
}

/**
 * Normalise anything thrown or returned as an error. Supabase/PostgREST errors
 * are plain objects ({ message, code, details }), not Error instances, and used
 * to be dropped from the log entry entirely.
 */
function describeError(error: unknown): LogEntry['error'] | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: maskPII(error.message),
      stack: isProduction() ? undefined : error.stack,
    };
  }
  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      name: typeof e.name === 'string' ? e.name : 'Error',
      message: maskPII(typeof e.message === 'string' ? e.message : JSON.stringify(e).slice(0, 500)),
      code: typeof e.code === 'string' ? e.code : undefined,
    };
  }
  return { name: 'Error', message: maskPII(String(error)) };
}

/**
 * Create log entry
 */
function createLogEntry(
  ctx: LoggerContext,
  level: string,
  message: string,
  metadata?: Record<string, unknown>,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: maskPII(message),
    function_name: ctx.functionName,
    request_id: ctx.requestId,
    user_id: ctx.userId,
  };

  if (metadata) {
    entry.metadata = sanitizeObject(metadata) as Record<string, unknown>;
  }

  const err = describeError(error);
  if (err) entry.error = err;

  return entry;
}

/**
 * Output log entry
 */
function outputLog(level: LogLevel, entry: LogEntry): void {
  if (level < getLogLevel()) return;

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

/** Accept only a short, header-safe request id; anything else is replaced. */
export function requestIdFrom(req: Request): string {
  const supplied = req.headers.get('x-request-id') || req.headers.get('x-correlation-id') || '';
  return /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

/**
 * Edge Function Logger
 */
export class EdgeFunctionLogger {
  private readonly ctx: LoggerContext;

  constructor(functionName: string, ctx: Omit<LoggerContext, 'functionName'> = {}) {
    this.ctx = { ...ctx, functionName };
  }

  /** A logger bound to one request (request id from the x-request-id header). */
  forRequest(req: Request): EdgeFunctionLogger {
    return new EdgeFunctionLogger(this.ctx.functionName ?? 'unknown', {
      ...this.ctx,
      requestId: requestIdFrom(req),
    });
  }

  /** A copy of this logger that also tags entries with the acting user id. */
  withUser(userId: string | undefined): EdgeFunctionLogger {
    return new EdgeFunctionLogger(this.ctx.functionName ?? 'unknown', { ...this.ctx, userId });
  }

  get requestId(): string | undefined {
    return this.ctx.requestId;
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    outputLog(LogLevel.DEBUG, createLogEntry(this.ctx, 'debug', message, metadata));
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    outputLog(LogLevel.INFO, createLogEntry(this.ctx, 'info', message, metadata));
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    outputLog(LogLevel.WARN, createLogEntry(this.ctx, 'warn', message, metadata));
  }

  error(message: string, error?: unknown, metadata?: Record<string, unknown>): void {
    outputLog(LogLevel.ERROR, createLogEntry(this.ctx, 'error', message, metadata, error));
  }
}

/**
 * Create a logger for an Edge Function
 */
export function createEdgeFunctionLogger(functionName: string): EdgeFunctionLogger {
  return new EdgeFunctionLogger(functionName);
}
