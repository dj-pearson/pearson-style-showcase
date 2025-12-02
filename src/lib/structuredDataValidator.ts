/**
 * Structured Data Validator
 * Validates JSON-LD structured data against Schema.org requirements
 * and Google Rich Results requirements
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  recommendations: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

// Required fields by schema type
const REQUIRED_FIELDS: Record<string, string[]> = {
  Article: ['headline', 'author', 'datePublished', 'image'],
  Product: ['name', 'image', 'offers'],
  FAQPage: ['mainEntity'],
  HowTo: ['name', 'step'],
  BreadcrumbList: ['itemListElement'],
  Person: ['name'],
  Organization: ['name'],
  WebSite: ['name', 'url'],
  Review: ['itemReviewed', 'reviewRating', 'author'],
};

// Recommended fields for better rich results
const RECOMMENDED_FIELDS: Record<string, string[]> = {
  Article: ['dateModified', 'publisher', 'description', 'mainEntityOfPage'],
  Product: ['description', 'brand', 'aggregateRating', 'review'],
  Person: ['jobTitle', 'sameAs', 'image'],
  Organization: ['logo', 'contactPoint', 'sameAs'],
  WebSite: ['potentialAction', 'description'],
};

// Field validation rules
const FIELD_VALIDATORS: Record<string, (value: unknown) => string | null> = {
  url: (value) => {
    if (typeof value !== 'string') return 'URL must be a string';
    try {
      new URL(value);
      return null;
    } catch {
      return 'Invalid URL format';
    }
  },
  datePublished: (value) => {
    if (typeof value !== 'string') return 'Date must be a string';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Invalid date format (use ISO 8601)';
    return null;
  },
  dateModified: (value) => {
    if (typeof value !== 'string') return 'Date must be a string';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Invalid date format (use ISO 8601)';
    return null;
  },
  image: (value) => {
    if (typeof value === 'string') {
      try {
        new URL(value);
        return null;
      } catch {
        return 'Image URL is invalid';
      }
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj['@type'] === 'ImageObject' && obj.url) return null;
    }
    return 'Image must be a valid URL or ImageObject';
  },
  ratingValue: (value) => {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return 'Rating value must be a number';
    }
    const num = Number(value);
    if (isNaN(num) || num < 0 || num > 5) {
      return 'Rating value should be between 0 and 5';
    }
    return null;
  },
};

/**
 * Validate JSON-LD structured data
 */
export function validateStructuredData(data: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const recommendations: string[] = [];

  // Check for @context
  if (!data['@context']) {
    errors.push({
      field: '@context',
      message: 'Missing @context - should be "https://schema.org"',
      severity: 'error',
    });
  } else if (data['@context'] !== 'https://schema.org') {
    warnings.push({
      field: '@context',
      message: 'Consider using "https://schema.org" for @context',
      severity: 'warning',
    });
  }

  // Check for @type
  if (!data['@type']) {
    errors.push({
      field: '@type',
      message: 'Missing @type - specify the schema type',
      severity: 'error',
    });
    return { isValid: false, errors, warnings, recommendations };
  }

  const schemaType = data['@type'] as string;

  // Check required fields
  const requiredFields = REQUIRED_FIELDS[schemaType] || [];
  for (const field of requiredFields) {
    if (!data[field]) {
      errors.push({
        field,
        message: `Missing required field "${field}" for ${schemaType}`,
        severity: 'error',
      });
    }
  }

  // Check recommended fields
  const recommendedFields = RECOMMENDED_FIELDS[schemaType] || [];
  for (const field of recommendedFields) {
    if (!data[field]) {
      recommendations.push(`Consider adding "${field}" for better rich results`);
    }
  }

  // Validate specific field formats
  for (const [field, value] of Object.entries(data)) {
    if (FIELD_VALIDATORS[field]) {
      const error = FIELD_VALIDATORS[field](value);
      if (error) {
        warnings.push({
          field,
          message: error,
          severity: 'warning',
        });
      }
    }
  }

  // Type-specific validations
  switch (schemaType) {
    case 'Article':
      validateArticle(data, errors, warnings, recommendations);
      break;
    case 'Product':
      validateProduct(data, errors, warnings, recommendations);
      break;
    case 'FAQPage':
      validateFAQ(data, errors, warnings);
      break;
    case 'BreadcrumbList':
      validateBreadcrumb(data, errors, warnings);
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations,
  };
}

function validateArticle(
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  recommendations: string[]
) {
  // Check headline length
  if (data.headline && typeof data.headline === 'string') {
    if (data.headline.length > 110) {
      warnings.push({
        field: 'headline',
        message: 'Headline should be under 110 characters for best display',
        severity: 'warning',
      });
    }
  }

  // Check author structure
  if (data.author) {
    const author = data.author as Record<string, unknown>;
    if (!author['@type'] || (author['@type'] !== 'Person' && author['@type'] !== 'Organization')) {
      warnings.push({
        field: 'author',
        message: 'Author should have @type of "Person" or "Organization"',
        severity: 'warning',
      });
    }
    if (!author.name) {
      errors.push({
        field: 'author.name',
        message: 'Author must have a name',
        severity: 'error',
      });
    }
  }

  // Check for AI search optimization fields
  if (!data.about) {
    recommendations.push('Add "about" field with main topics for AI search optimization');
  }
  if (!data.speakable) {
    recommendations.push('Add "speakable" field for voice search optimization');
  }
}

function validateProduct(
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  recommendations: string[]
) {
  // Check offers
  if (data.offers) {
    const offers = data.offers as Record<string, unknown>;
    if (!offers.price && !offers.priceRange) {
      errors.push({
        field: 'offers.price',
        message: 'Product offers must include price or priceRange',
        severity: 'error',
      });
    }
    if (!offers.priceCurrency) {
      warnings.push({
        field: 'offers.priceCurrency',
        message: 'Consider adding priceCurrency (e.g., "USD")',
        severity: 'warning',
      });
    }
    if (!offers.availability) {
      recommendations.push('Add availability to offers for better rich results');
    }
  }

  // Check for reviews
  if (!data.aggregateRating && !data.review) {
    recommendations.push('Add reviews or aggregateRating for star ratings in search results');
  }
}

function validateFAQ(
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (data.mainEntity && Array.isArray(data.mainEntity)) {
    const questions = data.mainEntity as Array<Record<string, unknown>>;
    if (questions.length === 0) {
      errors.push({
        field: 'mainEntity',
        message: 'FAQPage must have at least one question',
        severity: 'error',
      });
    }
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q['@type'] !== 'Question') {
        errors.push({
          field: `mainEntity[${i}]`,
          message: 'Each FAQ item must have @type "Question"',
          severity: 'error',
        });
      }
      if (!q.name) {
        errors.push({
          field: `mainEntity[${i}].name`,
          message: 'Question must have a name (the question text)',
          severity: 'error',
        });
      }
      if (!q.acceptedAnswer) {
        errors.push({
          field: `mainEntity[${i}].acceptedAnswer`,
          message: 'Question must have an acceptedAnswer',
          severity: 'error',
        });
      }
    }
  }
}

function validateBreadcrumb(
  data: Record<string, unknown>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
) {
  if (data.itemListElement && Array.isArray(data.itemListElement)) {
    const items = data.itemListElement as Array<Record<string, unknown>>;
    if (items.length === 0) {
      errors.push({
        field: 'itemListElement',
        message: 'BreadcrumbList must have at least one item',
        severity: 'error',
      });
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.position !== i + 1) {
        warnings.push({
          field: `itemListElement[${i}].position`,
          message: `Position should be ${i + 1}, found ${item.position}`,
          severity: 'warning',
        });
      }
      if (!item.name) {
        errors.push({
          field: `itemListElement[${i}].name`,
          message: 'Breadcrumb item must have a name',
          severity: 'error',
        });
      }
      if (!item.item && i < items.length - 1) {
        warnings.push({
          field: `itemListElement[${i}].item`,
          message: 'Non-final breadcrumb items should have a URL',
          severity: 'warning',
        });
      }
    }
  }
}

/**
 * Generate a link to Google's Rich Results Test
 */
export function getGoogleRichResultsTestUrl(url: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`;
}

/**
 * Generate a link to Schema.org validator
 */
export function getSchemaValidatorUrl(url: string): string {
  return `https://validator.schema.org/?url=${encodeURIComponent(url)}`;
}
