import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  validateTextInput,
  validateUrl,
  validateEmail,
  validateSlug,
  sanitizeStringArray,
  validateJsonObject,
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
});
