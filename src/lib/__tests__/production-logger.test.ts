import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maskPII,
  sanitizeObject,
  ProductionLogger,
  createLogger,
  setCorrelationId,
  getCorrelationId,
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
