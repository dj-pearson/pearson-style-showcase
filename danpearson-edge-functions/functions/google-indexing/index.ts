import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Google Indexing API Edge Function
 *
 * Uses a Google Service Account (stored in GOOGLE_SERVICE_ACCOUNT_JSON env var)
 * to submit URLs to Google's Indexing API for faster crawling/indexing.
 *
 * Supports:
 * - URL_UPDATED: Notify Google a URL has been updated or created
 * - URL_DELETED: Notify Google a URL has been removed
 * - Batch submissions (up to 100 URLs per call)
 *
 * Reference: https://developers.google.com/search/apis/indexing-api/v3/prereqs
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const INDEXING_API_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface IndexingRequest {
  urls: string[];
  type?: "URL_UPDATED" | "URL_DELETED";
}

interface IndexingResult {
  url: string;
  success: boolean;
  error?: string;
}

/**
 * Base64url encode (no padding) for JWT
 */
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64url(text: string): string {
  return base64urlEncode(new TextEncoder().encode(text));
}

/**
 * Import a PEM private key for signing JWTs
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers and decode
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Create a signed JWT for Google OAuth2
 */
async function createSignedJwt(
  serviceAccount: ServiceAccountKey
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: INDEXING_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encodedHeader = textToBase64url(JSON.stringify(header));
  const encodedPayload = textToBase64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64urlEncode(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Get an OAuth2 access token using the service account JWT
 */
async function getAccessToken(
  serviceAccount: ServiceAccountKey
): Promise<string> {
  const jwt = await createSignedJwt(serviceAccount);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Submit a single URL to the Google Indexing API
 */
async function submitUrl(
  url: string,
  type: "URL_UPDATED" | "URL_DELETED",
  accessToken: string
): Promise<IndexingResult> {
  try {
    const response = await fetch(INDEXING_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Indexing API error for ${url}:`, errorData);
      return { url, success: false, error: `HTTP ${response.status}: ${errorData}` };
    }

    const result = await response.json();
    console.log(`Successfully submitted ${url}:`, result);
    return { url, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error submitting ${url}:`, message);
    return { url, success: false, error: message };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body
    const body: IndexingRequest = await req.json();
    const { urls, type = "URL_UPDATED" } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty 'urls' array in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (urls.length > 100) {
      return new Response(
        JSON.stringify({ error: "Maximum 100 URLs per request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate notification type
    if (type !== "URL_UPDATED" && type !== "URL_DELETED") {
      return new Response(
        JSON.stringify({ error: "Invalid type. Must be 'URL_UPDATED' or 'URL_DELETED'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load service account credentials from environment
    // Supports both raw JSON and base64-encoded JSON (use base64 to avoid
    // Docker ARG parsing issues with newlines in the private key)
    const serviceAccountRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountRaw) {
      console.error("GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set");
      return new Response(
        JSON.stringify({ error: "Google service account not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount: ServiceAccountKey;
    try {
      // Try parsing as raw JSON first
      let jsonString = serviceAccountRaw;
      // If it doesn't start with '{', assume it's base64-encoded
      if (!serviceAccountRaw.trimStart().startsWith("{")) {
        jsonString = atob(serviceAccountRaw);
      }
      serviceAccount = JSON.parse(jsonString);
    } catch {
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON (tried both raw JSON and base64)");
      return new Response(
        JSON.stringify({ error: "Invalid service account configuration. Ensure the value is valid JSON or base64-encoded JSON." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return new Response(
        JSON.stringify({ error: "Service account missing client_email or private_key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    console.log(`Getting access token for ${serviceAccount.client_email}`);
    const accessToken = await getAccessToken(serviceAccount);

    // Submit all URLs
    console.log(`Submitting ${urls.length} URL(s) with type ${type}`);
    const results: IndexingResult[] = [];

    for (const url of urls) {
      const result = await submitUrl(url, type, accessToken);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`Indexing complete: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: failureCount === 0,
        message: `Submitted ${successCount}/${urls.length} URLs successfully`,
        results,
      }),
      {
        status: failureCount === urls.length ? 500 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Google Indexing API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
