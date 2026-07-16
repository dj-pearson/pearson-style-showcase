/**
 * Input validation for affiliate click tracking (extracted from index.ts for
 * unit testing). A click identifies an article (UUID) and an Amazon ASIN.
 */
import { validateUuid, validateText } from '../_shared/validation.ts';

interface FieldResult {
  valid: boolean;
  sanitized?: unknown;
  error?: string;
}

export type ClickInputResult =
  | { valid: false; error: string }
  | { valid: true; articleIdResult: FieldResult; asinResult: FieldResult };

export function validateClickInput(articleId: unknown, asin: unknown): ClickInputResult {
  const articleIdResult = validateUuid(articleId);
  if (!articleIdResult.valid) {
    return { valid: false, error: 'Invalid articleId: must be a valid UUID' };
  }

  const asinResult = validateText(asin, { required: true, minLength: 1, maxLength: 20 });
  if (!asinResult.valid) {
    return { valid: false, error: 'Invalid asin: ' + asinResult.error };
  }

  return { valid: true, articleIdResult, asinResult };
}
