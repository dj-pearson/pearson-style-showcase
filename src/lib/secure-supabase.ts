/**
 * CSRF-aware Supabase helpers.
 *
 * State-changing requests must carry a CSRF token. The token is attached to the
 * actual HTTP request transparently by the Supabase client's custom fetch
 * (src/integrations/supabase/client.ts) and by invokeEdgeFunction — but only if
 * a token has been *provisioned* in sessionStorage. These helpers guarantee
 * provisioning before running a mutation, and provide a single auditable entry
 * point for critical state-changing operations.
 *
 * Usage:
 *   await secureMutation(() =>
 *     supabase.from('articles').delete().eq('id', id)
 *   );
 *   await secureInvokeEdgeFunction('admin-auth', { body: { action: 'logout' } });
 */
import { getCSRFToken } from '@/lib/csrf';
import {
  invokeEdgeFunction,
  type EdgeFunctionOptions,
  type EdgeFunctionResult,
} from '@/lib/edge-functions';

/**
 * Ensure a CSRF token exists in storage (generating one if needed) so the
 * client fetch layer can attach it to the following request(s).
 */
export async function ensureCsrfToken(): Promise<string> {
  return getCSRFToken();
}

/**
 * Run a Supabase mutation (insert/update/delete/rpc) with CSRF protection.
 * Provisions the token first, then executes the thunk; the client fetch attaches
 * the `x-csrf-token` header to the resulting request.
 */
export async function secureMutation<T>(mutation: () => T | PromiseLike<T>): Promise<T> {
  await ensureCsrfToken();
  return mutation();
}

/**
 * Invoke an edge function with CSRF protection. invokeEdgeFunction already
 * attaches the token for state-changing methods; this wrapper additionally
 * guarantees the token is provisioned and marks the call site as security
 * sensitive for audits.
 */
export async function secureInvokeEdgeFunction<T = unknown>(
  functionName: string,
  options: EdgeFunctionOptions = {}
): Promise<EdgeFunctionResult<T>> {
  await ensureCsrfToken();
  return invokeEdgeFunction<T>(functionName, options);
}
