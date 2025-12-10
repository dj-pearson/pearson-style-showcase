/**
 * Input Validation Decorators for Edge Functions
 *
 * This module provides reusable validation middleware for Supabase Edge Functions.
 * It includes validators for common input types, rate limiting, and schema validation.
 */

// Type definitions
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: unknown;
}

export interface ValidationRule<T = unknown> {
  name: string;
  validate: (value: unknown) => ValidationResult;
  transform?: (value: T) => T;
}

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'date' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  arrayOf?: SchemaField;
  properties?: Record<string, SchemaField>;
  sanitize?: boolean;
  transform?: (value: unknown) => unknown;
  customValidator?: (value: unknown) => ValidationResult;
}

export interface RequestSchema {
  body?: Record<string, SchemaField>;
  query?: Record<string, SchemaField>;
  headers?: Record<string, SchemaField>;
}

export interface ValidationContext {
  ip: string;
  userAgent: string;
  timestamp: number;
  method: string;
  path: string;
}

export interface ValidatedRequest<T = unknown> {
  body: T;
  query: Record<string, string>;
  headers: Record<string, string>;
  context: ValidationContext;
}

// CORS headers factory
export function createCorsHeaders(allowedOrigin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin || Deno.env.get('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };
}

// ============================================
// Basic Validators
// ============================================

/**
 * Validate and sanitize email addresses
 */
export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }

  const normalized = email.trim().toLowerCase();

  if (normalized.length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  if (normalized.length > 255) {
    return { valid: false, error: 'Email address is too long' };
  }

  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

  if (!emailRegex.test(normalized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, sanitized: normalized };
}

/**
 * Validate and sanitize text input
 */
export function validateText(
  text: unknown,
  options: { minLength?: number; maxLength?: number; required?: boolean } = {}
): ValidationResult {
  const { minLength = 0, maxLength = 10000, required = false } = options;

  if (typeof text !== 'string') {
    if (required) {
      return { valid: false, error: 'Text is required' };
    }
    return { valid: true, sanitized: '' };
  }

  // Trim and remove null bytes
  const sanitized = text.trim().replace(/\0/g, '');

  if (required && sanitized.length === 0) {
    return { valid: false, error: 'Text is required' };
  }

  if (sanitized.length < minLength) {
    return { valid: false, error: `Text must be at least ${minLength} characters` };
  }

  if (sanitized.length > maxLength) {
    return { valid: false, error: `Text must not exceed ${maxLength} characters` };
  }

  return { valid: true, sanitized };
}

/**
 * Validate URL
 */
export function validateUrl(url: unknown): ValidationResult {
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL must be a string' };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(trimmed);

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    return { valid: true, sanitized: urlObj.toString() };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate UUID
 */
export function validateUuid(uuid: unknown): ValidationResult {
  if (typeof uuid !== 'string') {
    return { valid: false, error: 'UUID must be a string' };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'Invalid UUID format' };
  }

  return { valid: true, sanitized: uuid.toLowerCase() };
}

/**
 * Validate number
 */
export function validateNumber(
  value: unknown,
  options: { min?: number; max?: number; integer?: boolean; required?: boolean } = {}
): ValidationResult {
  const { min, max, integer = false, required = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: 'Number is required' };
    }
    return { valid: true, sanitized: undefined };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof num !== 'number' || isNaN(num)) {
    return { valid: false, error: 'Invalid number format' };
  }

  if (!isFinite(num)) {
    return { valid: false, error: 'Number must be finite' };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: 'Number must be an integer' };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `Number must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `Number must not exceed ${max}` };
  }

  return { valid: true, sanitized: num };
}

/**
 * Validate boolean
 */
export function validateBoolean(value: unknown, options: { required?: boolean } = {}): ValidationResult {
  const { required = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: 'Boolean is required' };
    }
    return { valid: true, sanitized: undefined };
  }

  if (typeof value === 'boolean') {
    return { valid: true, sanitized: value };
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['true', '1', 'yes'].includes(lower)) {
      return { valid: true, sanitized: true };
    }
    if (['false', '0', 'no'].includes(lower)) {
      return { valid: true, sanitized: false };
    }
  }

  if (typeof value === 'number') {
    return { valid: true, sanitized: value !== 0 };
  }

  return { valid: false, error: 'Invalid boolean format' };
}

/**
 * Validate date/datetime
 */
export function validateDate(value: unknown, options: { required?: boolean } = {}): ValidationResult {
  const { required = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: 'Date is required' };
    }
    return { valid: true, sanitized: undefined };
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    return { valid: false, error: 'Invalid date format' };
  }

  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date value' };
  }

  return { valid: true, sanitized: date.toISOString() };
}

/**
 * Validate array
 */
export function validateArray<T>(
  value: unknown,
  itemValidator: (item: unknown) => ValidationResult,
  options: { minLength?: number; maxLength?: number; required?: boolean } = {}
): ValidationResult {
  const { minLength = 0, maxLength = 100, required = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: 'Array is required' };
    }
    return { valid: true, sanitized: [] };
  }

  if (!Array.isArray(value)) {
    return { valid: false, error: 'Value must be an array' };
  }

  if (value.length < minLength) {
    return { valid: false, error: `Array must have at least ${minLength} items` };
  }

  if (value.length > maxLength) {
    return { valid: false, error: `Array must not exceed ${maxLength} items` };
  }

  const sanitized: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const result = itemValidator(value[i]);
    if (!result.valid) {
      return { valid: false, error: `Item ${i}: ${result.error}` };
    }
    sanitized.push(result.sanitized as T);
  }

  return { valid: true, sanitized };
}

/**
 * Validate enum value
 */
export function validateEnum(
  value: unknown,
  allowedValues: string[],
  options: { required?: boolean } = {}
): ValidationResult {
  const { required = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: 'Value is required' };
    }
    return { valid: true, sanitized: undefined };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: 'Value must be a string' };
  }

  if (!allowedValues.includes(value)) {
    return { valid: false, error: `Value must be one of: ${allowedValues.join(', ')}` };
  }

  return { valid: true, sanitized: value };
}

// ============================================
// Rate Limiting
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function */
  keyGenerator?: (req: Request, ctx: ValidationContext) => string;
}

/**
 * Rate limiting middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs, keyGenerator } = options;

  return (req: Request, ctx: ValidationContext): { allowed: boolean; remaining: number; resetIn: number } => {
    const key = keyGenerator ? keyGenerator(req, ctx) : ctx.ip;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Clean up expired entries periodically
    if (rateLimitStore.size > 10000) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (now > v.resetTime) {
          rateLimitStore.delete(k);
        }
      }
    }

    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetTime - now };
  };
}

// ============================================
// Schema Validation
// ============================================

/**
 * Validate a value against a schema field
 */
function validateSchemaField(value: unknown, field: SchemaField, fieldName: string): ValidationResult {
  // Handle required check
  if (value === null || value === undefined) {
    if (field.required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: undefined };
  }

  // Custom validator takes precedence
  if (field.customValidator) {
    const customResult = field.customValidator(value);
    if (!customResult.valid) {
      return customResult;
    }
    value = customResult.sanitized ?? value;
  }

  // Type-specific validation
  switch (field.type) {
    case 'string':
      return validateText(value, {
        minLength: field.minLength,
        maxLength: field.maxLength,
        required: field.required,
      });

    case 'email':
      return validateEmail(value);

    case 'url':
      return validateUrl(value);

    case 'uuid':
      return validateUuid(value);

    case 'number':
      return validateNumber(value, {
        min: field.min,
        max: field.max,
        required: field.required,
      });

    case 'boolean':
      return validateBoolean(value, { required: field.required });

    case 'date':
      return validateDate(value, { required: field.required });

    case 'array':
      if (!field.arrayOf) {
        return { valid: false, error: `${fieldName} array schema not defined` };
      }
      return validateArray(
        value,
        (item) => validateSchemaField(item, field.arrayOf!, `${fieldName} item`),
        { minLength: field.minLength, maxLength: field.maxLength, required: field.required }
      );

    case 'object':
      if (!field.properties) {
        if (typeof value !== 'object' || Array.isArray(value)) {
          return { valid: false, error: `${fieldName} must be an object` };
        }
        return { valid: true, sanitized: value };
      }
      return validateObjectSchema(value as Record<string, unknown>, field.properties, fieldName);

    default:
      return { valid: false, error: `Unknown field type for ${fieldName}` };
  }
}

/**
 * Validate an object against a schema
 */
function validateObjectSchema(
  obj: Record<string, unknown>,
  schema: Record<string, SchemaField>,
  prefix = ''
): ValidationResult {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { valid: false, error: `${prefix || 'Body'} must be an object` };
  }

  const sanitized: Record<string, unknown> = {};
  const errors: string[] = [];

  // Validate each field in schema
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = obj[fieldName];
    const fullFieldName = prefix ? `${prefix}.${fieldName}` : fieldName;
    const result = validateSchemaField(value, fieldSchema, fullFieldName);

    if (!result.valid) {
      errors.push(result.error!);
    } else if (result.sanitized !== undefined) {
      sanitized[fieldName] = result.sanitized;
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true, sanitized };
}

// ============================================
// Request Validation Middleware
// ============================================

export type RequestHandler<T = unknown> = (
  req: ValidatedRequest<T>,
  rawReq: Request
) => Promise<Response>;

export interface MiddlewareOptions<T = unknown> {
  /** Schema for request validation */
  schema?: RequestSchema;
  /** Rate limiting configuration */
  rateLimit?: RateLimitOptions;
  /** Allowed HTTP methods */
  methods?: string[];
  /** CORS configuration */
  cors?: {
    origin?: string;
    credentials?: boolean;
  };
  /** Authentication required */
  requireAuth?: boolean;
  /** Custom pre-validation hook */
  beforeValidation?: (req: Request, ctx: ValidationContext) => Promise<Response | null>;
  /** Custom post-validation hook */
  afterValidation?: (req: ValidatedRequest<T>, rawReq: Request) => Promise<Response | null>;
}

/**
 * Create a validated request handler with middleware
 */
export function createHandler<T = unknown>(
  handler: RequestHandler<T>,
  options: MiddlewareOptions<T> = {}
): (req: Request) => Promise<Response> {
  const {
    schema,
    rateLimit,
    methods = ['POST'],
    cors = {},
    requireAuth = false,
    beforeValidation,
    afterValidation,
  } = options;

  const corsHeaders = createCorsHeaders(cors.origin);
  if (cors.credentials) {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  const rateLimiter = rateLimit ? createRateLimiter(rateLimit) : null;

  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Build validation context
    const context: ValidationContext = {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      timestamp: Date.now(),
      method: req.method,
      path: new URL(req.url).pathname,
    };

    try {
      // Check HTTP method
      if (!methods.includes(req.method)) {
        return new Response(
          JSON.stringify({ error: `Method ${req.method} not allowed` }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Apply rate limiting
      if (rateLimiter) {
        const limitResult = rateLimiter(req, context);
        if (!limitResult.allowed) {
          return new Response(
            JSON.stringify({
              error: 'Too many requests. Please try again later.',
              retryAfter: Math.ceil(limitResult.resetIn / 1000),
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(Math.ceil(limitResult.resetIn / 1000)),
                'X-RateLimit-Remaining': String(limitResult.remaining),
              },
            }
          );
        }
      }

      // Custom pre-validation hook
      if (beforeValidation) {
        const response = await beforeValidation(req, context);
        if (response) return response;
      }

      // Check authentication if required
      if (requireAuth) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Parse and validate request body
      let body: T = {} as T;
      if (schema?.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          const rawBody = await req.json();
          const result = validateObjectSchema(rawBody, schema.body);
          if (!result.valid) {
            return new Response(
              JSON.stringify({ error: result.error }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          body = result.sanitized as T;
        } catch (parseError) {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Parse query parameters
      const queryParams: Record<string, string> = {};
      const url = new URL(req.url);
      url.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });

      // Validate query parameters
      if (schema?.query) {
        const result = validateObjectSchema(queryParams, schema.query, 'query');
        if (!result.valid) {
          return new Response(
            JSON.stringify({ error: result.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        Object.assign(queryParams, result.sanitized);
      }

      // Get headers
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      // Build validated request
      const validatedRequest: ValidatedRequest<T> = {
        body,
        query: queryParams,
        headers,
        context,
      };

      // Custom post-validation hook
      if (afterValidation) {
        const response = await afterValidation(validatedRequest, req);
        if (response) return response;
      }

      // Call the handler
      const response = await handler(validatedRequest, req);

      // Ensure CORS headers are present
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (!responseHeaders.has(key)) {
          responseHeaders.set(key, value);
        }
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      console.error('Handler error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  };
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create a JSON success response
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(errors: string | string[]): Response {
  const errorList = Array.isArray(errors) ? errors : [errors];
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: errorList,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// ============================================
// Security Validators
// ============================================

/** Disposable email domains to block */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
  'mailinator.com', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com',
  'getnada.com', 'tempinbox.com', 'yopmail.com', 'maildrop.cc',
]);

/**
 * Validate email is not from a disposable domain
 */
export function validateNonDisposableEmail(email: unknown): ValidationResult {
  const baseResult = validateEmail(email);
  if (!baseResult.valid) return baseResult;

  const emailStr = baseResult.sanitized as string;
  const domain = emailStr.split('@')[1];

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable email addresses are not allowed' };
  }

  return baseResult;
}

/**
 * Validate password strength
 */
export function validatePassword(
  password: unknown,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecial?: boolean;
  } = {}
): ValidationResult {
  const {
    minLength = 12,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecial = true,
  } = options;

  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }

  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters` };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (requireNumbers && !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true, sanitized: password };
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(html: unknown): ValidationResult {
  if (typeof html !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }

  // Basic HTML entity encoding
  const sanitized = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return { valid: true, sanitized };
}

/**
 * Validate slug format
 */
export function validateSlug(slug: unknown): ValidationResult {
  if (typeof slug !== 'string') {
    return { valid: false, error: 'Slug must be a string' };
  }

  const normalized = slug.trim().toLowerCase();

  if (normalized.length === 0) {
    return { valid: false, error: 'Slug is required' };
  }

  if (normalized.length > 200) {
    return { valid: false, error: 'Slug must not exceed 200 characters' };
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(normalized)) {
    return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
  }

  return { valid: true, sanitized: normalized };
}

// Export all validators for easy access
export const validators = {
  email: validateEmail,
  nonDisposableEmail: validateNonDisposableEmail,
  text: validateText,
  url: validateUrl,
  uuid: validateUuid,
  number: validateNumber,
  boolean: validateBoolean,
  date: validateDate,
  array: validateArray,
  enum: validateEnum,
  password: validatePassword,
  slug: validateSlug,
  html: sanitizeHtml,
};
