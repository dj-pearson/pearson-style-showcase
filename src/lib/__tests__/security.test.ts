import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  validateTextInput,
  validateUrl,
  validateEmail,
  validateSlug,
  sanitizeStringArray,
  validateJsonObject,
  validatePasswordStrength,
  getPasswordStrengthLabel,
  validateImageAltText,
  DEFAULT_PASSWORD_REQUIREMENTS,
} from '../security';

describe('Security Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Hello <strong>World</strong></p>');
    });

    it('should remove dangerous script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Hello</p>');
    });

    it('should remove event handlers', () => {
      const input = '<p onclick="alert(\'xss\')">Click me</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
    });

    it('should allow safe attributes', () => {
      const input = '<a href="https://example.com" title="Link">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toContain('href');
      expect(result).toContain('title');
    });
  });

  describe('validateTextInput', () => {
    it('should accept valid text input', () => {
      const input = 'Hello World';
      const result = validateTextInput(input);
      expect(result).toBe('Hello World');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = validateTextInput(input);
      expect(result).toBe('Hello World');
    });

    it('should reject empty strings', () => {
      const result = validateTextInput('   ');
      expect(result).toBeNull();
    });

    it('should reject strings exceeding max length', () => {
      const input = 'a'.repeat(1001);
      const result = validateTextInput(input, 1000);
      expect(result).toBeNull();
    });

    it('should remove null bytes', () => {
      const input = 'Hello\0World';
      const result = validateTextInput(input);
      expect(result).toBe('HelloWorld');
    });

    it('should reject non-string input', () => {
      const result = validateTextInput(123 as any);
      expect(result).toBeNull();
    });
  });

  describe('validateUrl', () => {
    it('should accept valid HTTP URLs', () => {
      const url = 'http://example.com';
      const result = validateUrl(url);
      expect(result).toBe('http://example.com/');
    });

    it('should accept valid HTTPS URLs', () => {
      const url = 'https://example.com/path?query=value';
      const result = validateUrl(url);
      expect(result).toContain('https://example.com');
    });

    it('should reject javascript: protocol', () => {
      const url = 'javascript:alert("xss")';
      const result = validateUrl(url);
      expect(result).toBeNull();
    });

    it('should reject data: protocol', () => {
      const url = 'data:text/html,<script>alert("xss")</script>';
      const result = validateUrl(url);
      expect(result).toBeNull();
    });

    it('should reject invalid URLs', () => {
      const url = 'not a url';
      const result = validateUrl(url);
      expect(result).toBeNull();
    });

    it('should trim whitespace', () => {
      const url = '  https://example.com  ';
      const result = validateUrl(url);
      expect(result).toBe('https://example.com/');
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@example.com',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result).toBe(email.toLowerCase());
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result).toBeNull();
      });
    });

    it('should convert email to lowercase', () => {
      const email = 'User@Example.COM';
      const result = validateEmail(email);
      expect(result).toBe('user@example.com');
    });

    it('should reject emails exceeding 255 characters', () => {
      const email = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(email);
      expect(result).toBeNull();
    });

    it('should trim whitespace', () => {
      const email = '  user@example.com  ';
      const result = validateEmail(email);
      expect(result).toBe('user@example.com');
    });
  });

  describe('validateSlug', () => {
    it('should accept valid slugs', () => {
      const validSlugs = [
        'hello-world',
        'my-awesome-post',
        'react-2024',
      ];

      validSlugs.forEach(slug => {
        const result = validateSlug(slug);
        expect(result).toBe(slug);
      });
    });

    it('should reject invalid slugs', () => {
      const invalidSlugs = [
        'Hello World',
        'hello_world',
        'hello--world',
        '-hello',
        'hello-',
        'hello@world',
      ];

      invalidSlugs.forEach(slug => {
        const result = validateSlug(slug);
        expect(result).toBeNull();
      });
    });

    it('should convert to lowercase', () => {
      const slug = 'Hello-World';
      const result = validateSlug(slug);
      expect(result).toBe('hello-world');
    });

    it('should reject slugs exceeding 200 characters', () => {
      const slug = 'a'.repeat(201);
      const result = validateSlug(slug);
      expect(result).toBeNull();
    });
  });

  describe('sanitizeStringArray', () => {
    it('should sanitize array of valid strings', () => {
      const input = ['hello', 'world', 'test'];
      const result = sanitizeStringArray(input);
      expect(result).toEqual(['hello', 'world', 'test']);
    });

    it('should filter out invalid items', () => {
      const input = ['valid', '', '   ', 'a'.repeat(101)];
      const result = sanitizeStringArray(input, 100);
      expect(result).toEqual(['valid']);
    });

    it('should handle mixed types', () => {
      const input = ['valid', 123, null, undefined, 'test'] as any[];
      const result = sanitizeStringArray(input);
      expect(result).toEqual(['valid', 'test']);
    });

    it('should return empty array for non-array input', () => {
      const result = sanitizeStringArray('not an array' as any);
      expect(result).toEqual([]);
    });
  });

  describe('validateJsonObject', () => {
    it('should sanitize valid JSON object', () => {
      const input = {
        name: 'John',
        age: 30,
        active: true,
      };
      const result = validateJsonObject(input);
      expect(result).toEqual({
        name: 'John',
        age: 30,
        active: true,
      });
    });

    it('should filter keys when allowedKeys is provided', () => {
      const input = {
        name: 'John',
        age: 30,
        secret: 'password',
      };
      const result = validateJsonObject(input, ['name', 'age']);
      expect(result).toEqual({
        name: 'John',
        age: 30,
      });
      expect(result).not.toHaveProperty('secret');
    });

    it('should sanitize string values', () => {
      const input = {
        text: '  hello  ',
      };
      const result = validateJsonObject(input);
      expect(result?.text).toBe('hello');
    });

    it('should handle array values', () => {
      const input = {
        tags: ['tag1', 'tag2', 'tag3'],
      };
      const result = validateJsonObject(input);
      expect(result?.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should reject non-object input', () => {
      expect(validateJsonObject(null)).toBeNull();
      expect(validateJsonObject([])).toBeNull();
      expect(validateJsonObject('string')).toBeNull();
      expect(validateJsonObject(123)).toBeNull();
    });

    it('should skip complex nested objects', () => {
      const input = {
        name: 'John',
        nested: { deep: 'value' },
      };
      const result = validateJsonObject(input);
      expect(result).toHaveProperty('name');
      expect(result).not.toHaveProperty('nested');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const result = validatePasswordStrength('MyStr0ng!P@ssw0rd');
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters');
    });

    it('should require uppercase letters', () => {
      const result = validatePasswordStrength('alllowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = validatePasswordStrength('ALLUPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = validatePasswordStrength('NoNumbersHere!!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special characters', () => {
      const result = validatePasswordStrength('NoSpecialChars123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*...)');
    });

    it('should reject common passwords', () => {
      const result = validatePasswordStrength('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This password is too common and easily guessed');
    });

    it('should detect sequential characters', () => {
      const result = validatePasswordStrength('MyP@ss123456word');
      expect(result.suggestions.some(s => s.includes('sequential'))).toBe(true);
    });

    it('should detect keyboard patterns', () => {
      const result = validatePasswordStrength('Qwerty123456!@');
      expect(result.suggestions.some(s => s.includes('keyboard'))).toBe(true);
    });

    it('should handle empty input', () => {
      const result = validatePasswordStrength('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    it('should accept custom requirements', () => {
      const result = validatePasswordStrength('Short1!', {
        minLength: 6,
        requireUppercase: false,
        requireSpecialChars: false,
      });
      expect(result.errors).not.toContain('Password must be at least 12 characters');
    });

    it('should give bonus for extra length', () => {
      const shortResult = validatePasswordStrength('MyStr0ng!Pass');
      const longResult = validatePasswordStrength('MyStr0ng!P@sswrdThatIsVeryLong');
      expect(longResult.score).toBeGreaterThan(shortResult.score);
    });

    it('should detect repeated characters', () => {
      const result = validatePasswordStrength('MyStr0ng!!!Pass');
      expect(result.suggestions.some(s => s.includes('repeat'))).toBe(true);
    });
  });

  describe('getPasswordStrengthLabel', () => {
    it('should return Very Weak for scores below 25', () => {
      expect(getPasswordStrengthLabel(10)).toEqual({ label: 'Very Weak', color: 'red' });
      expect(getPasswordStrengthLabel(24)).toEqual({ label: 'Very Weak', color: 'red' });
    });

    it('should return Weak for scores 25-49', () => {
      expect(getPasswordStrengthLabel(25)).toEqual({ label: 'Weak', color: 'orange' });
      expect(getPasswordStrengthLabel(49)).toEqual({ label: 'Weak', color: 'orange' });
    });

    it('should return Fair for scores 50-74', () => {
      expect(getPasswordStrengthLabel(50)).toEqual({ label: 'Fair', color: 'yellow' });
      expect(getPasswordStrengthLabel(74)).toEqual({ label: 'Fair', color: 'yellow' });
    });

    it('should return Strong for scores 75-89', () => {
      expect(getPasswordStrengthLabel(75)).toEqual({ label: 'Strong', color: 'green' });
      expect(getPasswordStrengthLabel(89)).toEqual({ label: 'Strong', color: 'green' });
    });

    it('should return Very Strong for scores 90+', () => {
      expect(getPasswordStrengthLabel(90)).toEqual({ label: 'Very Strong', color: 'emerald' });
      expect(getPasswordStrengthLabel(100)).toEqual({ label: 'Very Strong', color: 'emerald' });
    });
  });

  describe('validateImageAltText', () => {
    it('should accept valid alt text', () => {
      const result = validateImageAltText('A dog playing in the park');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty alt text by default', () => {
      const result = validateImageAltText('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alt text is required for accessibility');
    });

    it('should allow empty alt text when allowEmpty is true', () => {
      const result = validateImageAltText('', { allowEmpty: true });
      expect(result.isValid).toBe(true);
    });

    it('should allow empty alt text for decorative images', () => {
      const result = validateImageAltText('Has text but decorative', { isDecorativeImage: true });
      expect(result.isValid).toBe(true);
      expect(result.suggestions.some(s => s.includes('Decorative images'))).toBe(true);
    });

    it('should reject generic alt text', () => {
      const genericTexts = ['image', 'photo', 'picture', 'Image 1', 'photo 2'];
      genericTexts.forEach(text => {
        const result = validateImageAltText(text);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Alt text should be descriptive, not generic');
      });
    });

    it('should reject alt text with file extensions', () => {
      const result = validateImageAltText('my-photo.jpg');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alt text should not include file extensions');
    });

    it('should suggest removing redundant image prefixes', () => {
      const result = validateImageAltText('Image of a beautiful sunset');
      expect(result.suggestions.some(s => s.includes('redundant'))).toBe(true);
    });

    it('should reject alt text shorter than minLength', () => {
      const result = validateImageAltText('Hi', { minLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alt text should be at least 5 characters');
    });

    it('should reject alt text exceeding maxLength', () => {
      const longAlt = 'A'.repeat(150);
      const result = validateImageAltText(longAlt, { maxLength: 125 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alt text should not exceed 125 characters');
    });

    it('should reject alt text with HTML characters', () => {
      const result = validateImageAltText('Image <script>alert(1)</script>');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Alt text should not contain HTML characters');
    });

    it('should handle null and undefined', () => {
      const nullResult = validateImageAltText(null as unknown as string);
      expect(nullResult.isValid).toBe(false);

      const undefinedResult = validateImageAltText(undefined as unknown as string);
      expect(undefinedResult.isValid).toBe(false);
    });
  });

  describe('DEFAULT_PASSWORD_REQUIREMENTS', () => {
    it('should have OWASP-recommended defaults', () => {
      expect(DEFAULT_PASSWORD_REQUIREMENTS.minLength).toBe(12);
      expect(DEFAULT_PASSWORD_REQUIREMENTS.requireUppercase).toBe(true);
      expect(DEFAULT_PASSWORD_REQUIREMENTS.requireLowercase).toBe(true);
      expect(DEFAULT_PASSWORD_REQUIREMENTS.requireNumbers).toBe(true);
      expect(DEFAULT_PASSWORD_REQUIREMENTS.requireSpecialChars).toBe(true);
      expect(DEFAULT_PASSWORD_REQUIREMENTS.maxLength).toBe(128);
      expect(DEFAULT_PASSWORD_REQUIREMENTS.checkCommonPasswords).toBe(true);
    });
  });
});
