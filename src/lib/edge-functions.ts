/**
 * Edge Functions Helper for danpearson.net
 * 
 * Self-hosted edge functions at functions.danpearson.net
 * This helper provides a drop-in replacement for supabase.functions.invoke()
 */

import { supabase } from '@/integrations/supabase/client';

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.danpearson.net';

export interface EdgeFunctionOptions {
  body?: any;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
}

export interface EdgeFunctionResult<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * Invoke an edge function at functions.danpearson.net
 * Drop-in replacement for supabase.functions.invoke()
 * 
 * @param functionName - Name of the function to invoke
 * @param options - Options including body, headers, method
 * @returns Promise with data and error (matches Supabase API)
 * 
 * @example
 * ```typescript
 * // Before (cloud Supabase):
 * const { data, error } = await supabase.functions.invoke('my-function', { body: { ... } });
 * 
 * // After (self-hosted):
 * const { data, error } = await invokeEdgeFunction('my-function', { body: { ... } });
 * ```
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options: EdgeFunctionOptions = {}
): Promise<EdgeFunctionResult<T>> {
  try {
    const { body, headers = {}, method = 'POST' } = options;

    // Get auth token from current Supabase session
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || response.statusText };
      }

      return {
        data: null,
        error: new Error(errorData.error || errorData.message || `Function ${functionName} failed with status ${response.status}`),
      };
    }

    const data = await response.json();
    return { data, error: null };

  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Alternative: Direct fetch to edge function
 * Use this when you need more control over the request
 * 
 * @example
 * ```typescript
 * const response = await fetchEdgeFunction('my-function', {
 *   method: 'POST',
 *   body: { data: 'test' },
 *   token: session.access_token,
 * });
 * const data = await response.json();
 * ```
 */
export async function fetchEdgeFunction(
  functionName: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    token?: string;
  } = {}
): Promise<Response> {
  const { method = 'POST', body, headers = {}, token } = options;

  return fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Health check for edge functions service
 */
export async function checkEdgeFunctionsHealth(): Promise<{
  healthy: boolean;
  functions: string[];
  error?: string;
}> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/_health`);
    if (!response.ok) {
      return {
        healthy: false,
        functions: [],
        error: `Health check failed with status ${response.status}`,
      };
    }
    
    const data = await response.json();
    return {
      healthy: data.status === 'healthy',
      functions: data.functionList || [],
    };
  } catch (error) {
    return {
      healthy: false,
      functions: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
