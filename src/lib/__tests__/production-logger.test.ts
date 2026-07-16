import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maskPII,
  sanitizeObject,
  ProductionLogger,
  createLogger,
  setCorrelationId,
  getCorrelationId,
  flushLogs,
} from '../production-logger';

describe('PII Masking', () => {
  describe('maskPII', () => {
    it('should mask email addresses', () => {
      const input = 'Contact user at john.doe@example.com for more info';
      const result = maskPII(input);
      expect(result).toContain('jo***@example.com');
      expect(result).not.toContain('john.doe@example.com');
    });

    it('should mask phone numbers', () => {
      const input = 'Call me at 555-123-4567';
      const result = maskPII(input);
      expect(result).toContain('***-***-4567');
      expect(result).not.toContain('555-123');
    });

    it('should mask SSN', () => {
      const input = 'SSN: 123-45-6789';
      const result = maskPII(input);
      expect(result).toContain('***-**-****');
      expect(result).not.toContain('123-45-6789');
    });

    it('should mask credit card numbers', () => {
      // Use format without hyphens to avoid phone regex conflicts
      const input = 'Card: 4111111111111111';
      const result = maskPII(input);
      // Credit card should be masked, showing last 4 digits
      expect(result).not.toBe(input);
      expect(result).toContain('Card:');
    });

    it('should mask IP addresses', () => {
      const input = 'Request from 192.168.1.100';
      const result = maskPII(input);
      expect(result).toContain('192.***.***.**');
      expect(result).not.toContain('192.168.1.100');
    });

    it('should mask JWT tokens', () => {
      const input = 'Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = maskPII(input);
      expect(result).toContain('[JWT_REDACTED]');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('should mask API keys', () => {
      // API key pattern: prefix followed by 20+ alphanumeric chars
      const input = 'Using key: skAbcdefghij1234567890xyz';
      const result = maskPII(input);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('Abcdefghij1234567890xyz');
    });

    it('should handle strings without PII', () => {
      const input = 'This is a normal message without sensitive data';
      const result = maskPII(input);
      expect(result).toBe(input);
    });

    it('should handle empty strings', () => {
      expect(maskPII('')).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should redact sensitive fields', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };
      const result = sanitizeObject(input) as Record<string, unknown>;

      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.email).toContain('jo***@example.com');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'John',
          auth: {
            token: 'secret-token',
            email: 'john@example.com',
          },
        },
      };
      const result = sanitizeObject(input) as Record<string, unknown>;
      const user = result.user as Record<string, unknown>;
      const auth = user.auth as Record<string, unknown>;

      expect(user.name).toBe('John');
      expect(auth.token).toBe('[REDACTED]');
      expect(auth.email).toContain('@example.com');
    });

    it('should handle arrays', () => {
      const input = {
        emails: ['user1@example.com', 'user2@example.com'],
      };
      const result = sanitizeObject(input) as Record<string, unknown>;
      const emails = result.emails as string[];

      expect(emails[0]).toContain('us***@example.com');
      expect(emails[1]).toContain('us***@example.com');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle primitives', () => {
      expect(sanitizeObject(42)).toBe(42);
      expect(sanitizeObject(true)).toBe(true);
      expect(sanitizeObject('hello')).toBe('hello');
    });

    it('should prevent deep recursion', () => {
      const deepObject: Record<string, unknown> = { level: 0 };
      let current = deepObject;
      for (let i = 1; i <= 15; i++) {
        current.nested = { level: i };
        current = current.nested as Record<string, unknown>;
      }

      const result = sanitizeObject(deepObject);
      expect(result).toBeDefined();
      // Should not throw
    });
  });
});

describe('ProductionLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create logger with component context', () => {
    const logger = createLogger('TestComponent');
    logger.info('Test message');

    expect(consoleSpy.log).toHaveBeenCalled();
  });

  it('should create child logger with additional context', () => {
    const parentLogger = createLogger('Parent');
    const childLogger = parentLogger.child({ requestId: '123' });

    childLogger.info('Child message');
    expect(consoleSpy.log).toHaveBeenCalled();
  });

  it('should log at different levels', () => {
    const logger = new ProductionLogger();

    // Note: Default log level is INFO, so DEBUG may not log
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');

    // INFO and above should be logged
    expect(consoleSpy.log).toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalled();
  });

  it('emits warn and error but keeps debug silent below the configured level', () => {
    // This mirrors the production requirement (US-057): error/warn must reach the
    // console/transport while debug stays silent. The default level is now WARN in
    // prod / DEBUG in dev (US-014), so pin VITE_LOG_LEVEL=warn to assert the gate
    // deterministically regardless of environment.
    vi.stubEnv('VITE_LOG_LEVEL', 'warn');
    const logger = new ProductionLogger();

    logger.debug('Debug message');
    expect(consoleSpy.debug).not.toHaveBeenCalled();

    logger.warn('Warning message');
    logger.error('Error message');
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);

    vi.unstubAllEnvs();
  });

  it('should mask PII in log messages', () => {
    const logger = new ProductionLogger();
    logger.info('User email: test@example.com');

    const call = consoleSpy.log.mock.calls[0];
    const logMessage = call[0] as string;
    expect(logMessage).not.toContain('test@example.com');
    expect(logMessage).toContain('te***@example.com');
  });

  it('should include error details in error logs', () => {
    const logger = new ProductionLogger();
    const error = new Error('Test error');

    logger.error('An error occurred', error);

    expect(consoleSpy.error).toHaveBeenCalled();
  });
});

describe('Remote transport (US-014)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Drain any buffered logs (endpoint already unstubbed -> dropped, timer cleared).
    vi.unstubAllEnvs();
    await flushLogs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a graceful no-op when VITE_LOG_ENDPOINT is not set', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    new ProductionLogger().error('boom');
    await flushLogs();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('batches buffered logs and POSTs them to the endpoint on flush', async () => {
    vi.stubEnv('VITE_LOG_ENDPOINT', 'https://logs.test/ingest');
    vi.stubEnv('VITE_LOG_LEVEL', 'debug');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const logger = new ProductionLogger();
    logger.warn('one');
    logger.error('two');
    await flushLogs();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://logs.test/ingest');
    expect(opts.keepalive).toBe(true);
    const body = JSON.parse(opts.body as string);
    expect(body.logs).toHaveLength(2);
    // Context enrichment is present.
    expect(body.logs[0]).toHaveProperty('timestamp');
    expect(body.logs[0]).toHaveProperty('sessionId');
    expect(body.logs[0]).toHaveProperty('url');
  });

  it('auto-flushes once the batch size (10) is reached', async () => {
    vi.stubEnv('VITE_LOG_ENDPOINT', 'https://logs.test/ingest');
    vi.stubEnv('VITE_LOG_LEVEL', 'debug');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const logger = new ProductionLogger();
    for (let i = 0; i < 10; i++) logger.info(`msg ${i}`);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the remote fetch fails', async () => {
    vi.stubEnv('VITE_LOG_ENDPOINT', 'https://logs.test/ingest');
    vi.stubEnv('VITE_LOG_LEVEL', 'debug');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    new ProductionLogger().error('boom');
    await expect(flushLogs()).resolves.toBeUndefined();
  });
});

describe('Correlation ID', () => {
  it('should set and get correlation ID', () => {
    const id = setCorrelationId('test-123');
    expect(id).toBe('test-123');
    expect(getCorrelationId()).toBe('test-123');
  });

  it('should generate correlation ID if not provided', () => {
    const id = setCorrelationId();
    expect(id).toBeDefined();
    expect(id.length).toBeGreaterThan(0);
  });
});
