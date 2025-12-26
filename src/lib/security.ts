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

/**
 * Password strength requirements configuration
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLength: number;
  checkCommonPasswords: boolean;
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

/**
 * Default password requirements (OWASP recommended)
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128,
  checkCommonPasswords: true,
};

/**
 * Common passwords to reject (top 100 most common)
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'monkey', 'master', 'dragon', 'letmein', 'login',
  'admin', 'welcome', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'iloveyou',
  'sunshine', 'princess', 'football', 'baseball', 'shadow', 'superman',
  'michael', 'ashley', 'jessica', 'charlie', 'thomas', 'jennifer',
  'trustno1', 'hello', '123123', '654321', '1234567', '12345', '1234',
  'qwertyuiop', 'asdfgh', 'zxcvbn', 'qazwsx', 'password!', 'password1!',
  'changeme', 'default', 'guest', 'root', 'administrator', 'test',
  'demo', 'access', 'secret', 'pass', 'user', 'account', 'password12',
]);

/**
 * Validate password strength
 * @param password - The password to validate
 * @param requirements - Custom requirements (optional)
 * @returns Validation result with score, errors, and suggestions
 */
export function validatePasswordStrength(
  password: string,
  requirements: Partial<PasswordRequirements> = {}
): PasswordValidationResult {
  const config = { ...DEFAULT_PASSWORD_REQUIREMENTS, ...requirements };
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Check if password exists
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      score: 0,
      errors: ['Password is required'],
      suggestions: ['Enter a password'],
    };
  }

  // Check minimum length
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters`);
  } else {
    score += 20;
    // Bonus for extra length
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;
  }

  // Check maximum length
  if (password.length > config.maxLength) {
    errors.push(`Password must be less than ${config.maxLength} characters`);
  }

  // Check uppercase
  const hasUppercase = /[A-Z]/.test(password);
  if (config.requireUppercase && !hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (hasUppercase) {
    score += 15;
  }

  // Check lowercase
  const hasLowercase = /[a-z]/.test(password);
  if (config.requireLowercase && !hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (hasLowercase) {
    score += 15;
  }

  // Check numbers
  const hasNumbers = /[0-9]/.test(password);
  if (config.requireNumbers && !hasNumbers) {
    errors.push('Password must contain at least one number');
  } else if (hasNumbers) {
    score += 15;
  }

  // Check special characters
  const hasSpecialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);
  if (config.requireSpecialChars && !hasSpecialChars) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  } else if (hasSpecialChars) {
    score += 15;
  }

  // Check for common passwords
  if (config.checkCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('This password is too common and easily guessed');
      score = Math.max(0, score - 50);
    }
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    suggestions.push('Avoid repeating the same character multiple times');
    score = Math.max(0, score - 10);
  }

  // Check for sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    suggestions.push('Avoid sequential characters like "abc" or "123"');
    score = Math.max(0, score - 10);
  }

  // Check for keyboard patterns
  if (/(?:qwerty|asdf|zxcv|qazwsx)/i.test(password)) {
    suggestions.push('Avoid keyboard patterns like "qwerty"');
    score = Math.max(0, score - 15);
  }

  // Provide suggestions based on what's missing
  if (!hasUppercase) {
    suggestions.push('Add uppercase letters for stronger security');
  }
  if (!hasLowercase) {
    suggestions.push('Add lowercase letters for stronger security');
  }
  if (!hasNumbers) {
    suggestions.push('Add numbers for stronger security');
  }
  if (!hasSpecialChars) {
    suggestions.push('Add special characters (!@#$%) for stronger security');
  }
  if (password.length < 16) {
    suggestions.push('Consider using a longer password (16+ characters)');
  }

  // Cap score at 100
  score = Math.min(100, score);

  return {
    isValid: errors.length === 0,
    score,
    errors,
    suggestions: errors.length === 0 ? suggestions.slice(0, 2) : [],
  };
}

/**
 * Get password strength label based on score
 */
export function getPasswordStrengthLabel(score: number): {
  label: string;
  color: string;
} {
  if (score < 25) return { label: 'Very Weak', color: 'red' };
  if (score < 50) return { label: 'Weak', color: 'orange' };
  if (score < 75) return { label: 'Fair', color: 'yellow' };
  if (score < 90) return { label: 'Strong', color: 'green' };
  return { label: 'Very Strong', color: 'emerald' };
}

/**
 * Check if password has been breached (requires API call)
 * Uses k-anonymity model with Have I Been Pwned API
 * @param password - Password to check
 * @returns Promise with breach status
 */
export async function checkPasswordBreach(
  password: string
): Promise<{ breached: boolean; count?: number }> {
  try {
    // Create SHA-1 hash of password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Use k-anonymity: send only first 5 characters
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // Call HIBP API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true', // Adds padding to prevent response size analysis
      },
    });

    if (!response.ok) {
      // If API fails, don't block the user
      return { breached: false };
    }

    const text = await response.text();
    const lines = text.split('\n');

    // Check if our suffix is in the results
    for (const line of lines) {
      const [hash, countStr] = line.split(':');
      if (hash.trim() === suffix) {
        const count = parseInt(countStr.trim(), 10);
        return { breached: true, count };
      }
    }

    return { breached: false };
  } catch {
    // If check fails, don't block the user
    return { breached: false };
  }
}

/**
 * Alt text validation result
 */
export interface AltTextValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

/**
 * Validate image alt text for accessibility compliance
 * Following WCAG 2.1 guidelines for meaningful alt text
 * @param altText - The alt text to validate
 * @param options - Validation options
 * @returns Validation result with errors and suggestions
 */
export function validateImageAltText(
  altText: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    isDecorativeImage?: boolean;
  } = {}
): AltTextValidationResult {
  const {
    minLength = 5,
    maxLength = 125,
    allowEmpty = false,
    isDecorativeImage = false,
  } = options;

  const errors: string[] = [];
  const suggestions: string[] = [];

  // Decorative images should have empty alt text
  if (isDecorativeImage) {
    if (altText && altText.trim().length > 0) {
      suggestions.push('Decorative images should have empty alt text (alt="")');
    }
    return { isValid: true, errors, suggestions };
  }

  // Check for null/undefined
  if (altText === null || altText === undefined) {
    if (!allowEmpty) {
      errors.push('Alt text is required for accessibility');
    }
    return { isValid: allowEmpty, errors, suggestions };
  }

  const trimmed = altText.trim();

  // Check for empty alt text
  if (trimmed.length === 0) {
    if (!allowEmpty) {
      errors.push('Alt text is required for accessibility');
      suggestions.push('Describe the content and function of the image');
    }
    return { isValid: allowEmpty, errors, suggestions };
  }

  // Check minimum length
  if (trimmed.length < minLength) {
    errors.push(`Alt text should be at least ${minLength} characters`);
    suggestions.push('Provide a more descriptive alt text');
  }

  // Check maximum length (screen readers may truncate long text)
  if (trimmed.length > maxLength) {
    errors.push(`Alt text should not exceed ${maxLength} characters`);
    suggestions.push('Consider using a shorter, more concise description');
  }

  // Check for generic/meaningless alt text
  const genericPatterns = [
    /^image$/i,
    /^img$/i,
    /^photo$/i,
    /^picture$/i,
    /^pic$/i,
    /^graphic$/i,
    /^icon$/i,
    /^logo$/i,
    /^image\s*\d+$/i,
    /^img\s*\d+$/i,
    /^photo\s*\d+$/i,
    /^untitled$/i,
    /^screenshot$/i,
    /^image\s+of$/i,
    /^picture\s+of$/i,
    /^photo\s+of$/i,
  ];

  for (const pattern of genericPatterns) {
    if (pattern.test(trimmed)) {
      errors.push('Alt text should be descriptive, not generic');
      suggestions.push('Describe what the image shows or its purpose');
      break;
    }
  }

  // Check for file extension in alt text (common mistake)
  const fileExtPattern = /\.(jpg|jpeg|png|gif|webp|avif|svg|bmp|ico)$/i;
  if (fileExtPattern.test(trimmed)) {
    errors.push('Alt text should not include file extensions');
    suggestions.push('Remove the file extension and describe the image content');
  }

  // Check for "image of" prefix (redundant)
  if (/^(image|photo|picture|graphic|icon)\s+(of|showing)/i.test(trimmed)) {
    suggestions.push('Avoid starting with "image of" or "photo of" - this is redundant');
  }

  // Check for special characters that may cause issues
  if (/[<>]/.test(trimmed)) {
    errors.push('Alt text should not contain HTML characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions: errors.length === 0 ? suggestions : suggestions.slice(0, 2),
  };
}
