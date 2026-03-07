/**
 * Google Indexing API Service
 *
 * Submits URLs to Google's Indexing API via the google-indexing Edge Function.
 * Used to notify Google when articles are published, updated, or deleted.
 *
 * Prerequisites:
 * - GOOGLE_SERVICE_ACCOUNT_JSON env var set on the Edge Function
 * - Google Indexing API enabled in Google Cloud Console
 * - Service account added as owner in Google Search Console
 */

import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';

const SITE_URL = 'https://danpearson.net';

export type IndexingNotificationType = 'URL_UPDATED' | 'URL_DELETED';

export interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
}

export interface IndexingResponse {
  success: boolean;
  message: string;
  results: IndexingResult[];
}

/**
 * Submit URLs to Google Indexing API
 */
export async function submitUrlsToGoogleIndex(
  urls: string[],
  type: IndexingNotificationType = 'URL_UPDATED'
): Promise<IndexingResponse> {
  try {
    const { data, error } = await invokeEdgeFunction<IndexingResponse>('google-indexing', {
      body: { urls, type },
    });

    if (error) {
      logger.error('Google Indexing API error:', error);
      return {
        success: false,
        message: error.message,
        results: urls.map(url => ({ url, success: false, error: error.message })),
      };
    }

    if (data) {
      logger.log('Google Indexing API response:', data);
      return data;
    }

    return {
      success: false,
      message: 'No response from indexing API',
      results: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to submit URLs to Google Indexing:', message);
    return {
      success: false,
      message,
      results: urls.map(url => ({ url, success: false, error: message })),
    };
  }
}

/**
 * Notify Google that an article URL has been updated or created
 */
export async function notifyArticleUpdated(slug: string): Promise<IndexingResponse> {
  const url = `${SITE_URL}/news/${slug}`;
  return submitUrlsToGoogleIndex([url], 'URL_UPDATED');
}

/**
 * Notify Google that an article URL has been deleted
 */
export async function notifyArticleDeleted(slug: string): Promise<IndexingResponse> {
  const url = `${SITE_URL}/news/${slug}`;
  return submitUrlsToGoogleIndex([url], 'URL_DELETED');
}

/**
 * Notify Google about multiple article URLs (batch)
 */
export async function notifyArticlesUpdated(slugs: string[]): Promise<IndexingResponse> {
  const urls = slugs.map(slug => `${SITE_URL}/news/${slug}`);
  return submitUrlsToGoogleIndex(urls, 'URL_UPDATED');
}
