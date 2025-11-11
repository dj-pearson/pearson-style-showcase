import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

describe('Logger Utility', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original implementations
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it('should have log method', () => {
    expect(logger).toHaveProperty('log');
    expect(typeof logger.log).toBe('function');
  });

  it('should have error method', () => {
    expect(logger).toHaveProperty('error');
    expect(typeof logger.error).toBe('function');
  });

  it('should have warn method', () => {
    expect(logger).toHaveProperty('warn');
    expect(typeof logger.warn).toBe('function');
  });

  it('should have debug method', () => {
    expect(logger).toHaveProperty('debug');
    expect(typeof logger.debug).toBe('function');
  });

  it('should call console.log in development mode', () => {
    if (import.meta.env.DEV) {
      logger.log('test message', 123, { foo: 'bar' });
      expect(consoleLogSpy).toHaveBeenCalledWith('test message', 123, { foo: 'bar' });
    }
  });

  it('should call console.error in development mode', () => {
    if (import.meta.env.DEV) {
      logger.error('error message', new Error('test'));
      expect(consoleErrorSpy).toHaveBeenCalled();
    }
  });

  it('should call console.warn in development mode', () => {
    if (import.meta.env.DEV) {
      logger.warn('warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
    }
  });

  it('should call console.debug in development mode', () => {
    if (import.meta.env.DEV) {
      logger.debug('debug message');
      expect(consoleDebugSpy).toHaveBeenCalledWith('debug message');
    }
  });

  it('should accept multiple arguments', () => {
    if (import.meta.env.DEV) {
      const obj = { key: 'value' };
      const arr = [1, 2, 3];
      logger.log('Message', obj, arr, 42);
      expect(consoleLogSpy).toHaveBeenCalledWith('Message', obj, arr, 42);
    }
  });
});
