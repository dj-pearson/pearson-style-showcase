/**
 * Function-to-function invocation for the self-hosted deployment.
 *
 * `supabaseClient.functions.invoke()` resolves against SUPABASE_URL, which on
 * this deployment is api.danpearson.net (Kong). The edge functions do not live
 * there; they are served by the Deno server on functions.danpearson.net. Every
 * cross-function call made through the Supabase client therefore hits the wrong
 * host and fails silently, which is why notification and webhook emails stopped
 * sending. Route all of them through here instead.
 */

const DEFAULT_FUNCTIONS_URL = 'https://functions.danpearson.net';

function functionsUrl(): string {
  return (Deno.env.get('FUNCTIONS_URL') || DEFAULT_FUNCTIONS_URL).replace(/\/+$/, '');
}

export interface InvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

/**
 * Call another edge function with the service-role key and return its JSON body.
 *
 * Never throws: transport failures and non-2xx responses come back as `error`
 * so callers can decide whether a failed side effect should fail their request.
 */
export async function invokeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<InvokeResult<T>> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  try {
    const response = await fetch(`${functionsUrl()}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[invoke] ${functionName} returned ${response.status}: ${errorText}`);
      return { data: null, error: new Error(`${functionName} returned ${response.status}`) };
    }

    // A function may legitimately return an empty body; treat that as success.
    const text = await response.text();
    return { data: text ? (JSON.parse(text) as T) : null, error: null };
  } catch (error) {
    console.error(`[invoke] ${functionName} failed:`, error);
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Fire-and-forget variant for side effects that must not fail the caller.
 * A notification email that bounces should not roll back the ticket that
 * triggered it. Logs and swallows.
 */
export async function invokeFunctionAndForget(
  functionName: string,
  body: Record<string, unknown>
): Promise<void> {
  await invokeFunction(functionName, body);
}
