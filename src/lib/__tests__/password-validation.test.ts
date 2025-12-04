import { describe, it, expect } from 'vitest';
import {
  validatePasswordStrength,
  getPasswordStrengthLabel,
  DEFAULT_PASSWORD_REQUIREMENTS,
} from '../security';

describe('validatePasswordStrength', () => {
  describe('basic validation', () => {
    it('should reject empty password', () => {
      const result = validatePasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
      expect(result.score).toBe(0);
    });

    it('should reject null/undefined password', () => {
      const result = validatePasswordStrength(null as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should reject password below minimum length', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Password must be at least ${DEFAULT_PASSWORD_REQUIREMENTS.minLength} characters`
      );
    });

    it('should accept valid strong password', () => {
      const result = validatePasswordStrength('MySecure@Pass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(50);
    });
  });

  describe('character requirements', () => {
    it('should require uppercase letters', () => {
      const result = validatePasswordStrength('lowercaseonly123!@#');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should require lowercase letters', () => {
      const result = validatePasswordStrength('UPPERCASEONLY123!@#');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should require numbers', () => {
      const result = validatePasswordStrength('NoNumbersHere!@#$');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should require special characters', () => {
      const result = validatePasswordStrength('NoSpecialChars123AB');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character (!@#$%^&*...)'
      );
    });
  });

  describe('common password detection', () => {
    it('should reject common password "password"', () => {
      const result = validatePasswordStrength('password');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'This password is too common and easily guessed'
      );
    });

    it('should reject common password "123456"', () => {
      const result = validatePasswordStrength('123456');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'This password is too common and easily guessed'
      );
    });

    it('should reject common password "qwerty"', () => {
      const result = validatePasswordStrength('qwerty');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'This password is too common and easily guessed'
      );
    });
  });

  describe('pattern detection', () => {
    it('should suggest avoiding repeated characters', () => {
      const result = validatePasswordStrength('Passssword123!@#');
      expect(result.suggestions).toContain(
        'Avoid repeating the same character multiple times'
      );
    });

    it('should suggest avoiding sequential characters', () => {
      const result = validatePasswordStrength('Pabc123word!@#$');
      expect(result.suggestions).toContain(
        'Avoid sequential characters like "abc" or "123"'
      );
    });

    it('should suggest avoiding keyboard patterns', () => {
      const result = validatePasswordStrength('Pqwerty123word!@#');
      expect(result.suggestions).toContain(
        'Avoid keyboard patterns like "qwerty"'
      );
    });
  });

  describe('score calculation', () => {
    it('should give higher score for longer passwords', () => {
      const short = validatePasswordStrength('Pass123!Word@');
      const long = validatePasswordStrength('Pass123!Word@Extra');
      const veryLong = validatePasswordStrength('Pass123!Word@ExtraLongPassword');

      expect(long.score).toBeGreaterThan(short.score);
      expect(veryLong.score).toBeGreaterThan(long.score);
    });

    it('should cap score at 100', () => {
      const result = validatePasswordStrength(
        'VerySecure@Password123!WithExtraLength'
      );
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('custom requirements', () => {
    it('should allow custom minimum length', () => {
      const result = validatePasswordStrength('Short1!A', { minLength: 8 });
      expect(result.isValid).toBe(true);
    });

    it('should allow disabling uppercase requirement', () => {
      const result = validatePasswordStrength('lowercase123!@#', {
        requireUppercase: false,
        minLength: 12,
      });
      expect(result.errors).not.toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should allow disabling common password check', () => {
      const result = validatePasswordStrength('password', {
        checkCommonPasswords: false,
        minLength: 6,
        requireUppercase: false,
        requireNumbers: false,
        requireSpecialChars: false,
      });
      expect(result.errors).not.toContain(
        'This password is too common and easily guessed'
      );
    });
  });
});

describe('getPasswordStrengthLabel', () => {
  it('should return "Very Weak" for score < 25', () => {
    expect(getPasswordStrengthLabel(0).label).toBe('Very Weak');
    expect(getPasswordStrengthLabel(24).label).toBe('Very Weak');
    expect(getPasswordStrengthLabel(0).color).toBe('red');
  });

  it('should return "Weak" for score 25-49', () => {
    expect(getPasswordStrengthLabel(25).label).toBe('Weak');
    expect(getPasswordStrengthLabel(49).label).toBe('Weak');
    expect(getPasswordStrengthLabel(25).color).toBe('orange');
  });

  it('should return "Fair" for score 50-74', () => {
    expect(getPasswordStrengthLabel(50).label).toBe('Fair');
    expect(getPasswordStrengthLabel(74).label).toBe('Fair');
    expect(getPasswordStrengthLabel(50).color).toBe('yellow');
  });

  it('should return "Strong" for score 75-89', () => {
    expect(getPasswordStrengthLabel(75).label).toBe('Strong');
    expect(getPasswordStrengthLabel(89).label).toBe('Strong');
    expect(getPasswordStrengthLabel(75).color).toBe('green');
  });

  it('should return "Very Strong" for score >= 90', () => {
    expect(getPasswordStrengthLabel(90).label).toBe('Very Strong');
    expect(getPasswordStrengthLabel(100).label).toBe('Very Strong');
    expect(getPasswordStrengthLabel(90).color).toBe('emerald');
  });
});
