/**
 * Security utilities for input validation and sanitization
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The potentially unsafe HTML string
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  dirty: string,
  options?: any
): string {
  const defaultConfig: any = {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'img', 'div', 'span',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  };

  return String(DOMPurify.sanitize(dirty, { ...defaultConfig, ...options }));
}

/**
 * Validate and sanitize text input
 * @param input - The user input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string or null if invalid
 */
export function validateTextInput(
  input: string,
  maxLength: number = 1000
): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Check length
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }

  // Remove any null bytes
  const cleaned = trimmed.replace(/\0/g, '');

  return cleaned;
}

/**
 * Validate URL input
 * @param url - The URL string to validate
 * @returns Sanitized URL or null if invalid
 */
export function validateUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  // Basic URL validation
  try {
    const urlObj = new URL(trimmed);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    return urlObj.toString();
  } catch {
    return null;
  }
}

/**
 * Validate email format
 * @param email - The email string to validate
 * @returns Sanitized email or null if invalid
 */
export function validateEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const trimmed = email.trim().toLowerCase();

  // Comprehensive email regex
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (!emailRegex.test(trimmed) || trimmed.length > 255) {
    return null;
  }

  return trimmed;
}

/**
 * Validate slug format (URL-safe string)
 * @param slug - The slug string to validate
 * @returns Sanitized slug or null if invalid
 */
export function validateSlug(slug: string): string | null {
  if (!slug || typeof slug !== 'string') {
    return null;
  }

  const trimmed = slug.trim().toLowerCase();

  // Slug should only contain lowercase letters, numbers, and hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugRegex.test(trimmed) || trimmed.length > 200) {
    return null;
  }

  return trimmed;
}

/**
 * Sanitize array of strings
 * @param arr - Array of strings to sanitize
 * @param maxLength - Maximum length per string
 * @returns Array of sanitized strings
 */
export function sanitizeStringArray(
  arr: string[],
  maxLength: number = 100
): string[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr
    .filter(item => typeof item === 'string')
    .map(item => validateTextInput(item, maxLength))
    .filter((item): item is string => item !== null);
}

/**
 * Validate and sanitize JSON object
 * @param obj - Object to validate
 * @param allowedKeys - Array of allowed keys
 * @returns Sanitized object or null if invalid
 */
export function validateJsonObject(
  obj: any,
  allowedKeys?: string[]
): Record<string, any> | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return null;
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // If allowedKeys is specified, only include allowed keys
    if (allowedKeys && !allowedKeys.includes(key)) {
      continue;
    }

    // Sanitize based on value type
    if (typeof value === 'string') {
      sanitized[key] = validateTextInput(value, 500);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = sanitizeStringArray(value);
    }
    // Skip complex objects for security
  }

  return sanitized;
}
