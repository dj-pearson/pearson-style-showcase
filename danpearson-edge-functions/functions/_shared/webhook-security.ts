/**
 * Webhook Security Utilities
 * Provides HMAC signature verification for incoming webhooks
 */

/**
 * Generate HMAC-SHA256 signature for a payload
 * @param payload - The raw request body string
 * @param secret - The webhook secret key
 * @returns Hex-encoded HMAC signature
 */
export async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
  const signatureArray = new Uint8Array(signature);

  // Convert to hex string
  return Array.from(signatureArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify webhook signature
 * @param payload - The raw request body string
 * @param signature - The signature from request header
 * @param secret - The webhook secret key
 * @param timestamp - Optional timestamp to check for replay attacks
 * @param maxAgeSeconds - Maximum age of timestamp in seconds (default 5 minutes)
 * @returns Object with valid boolean and error message if invalid
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
  timestamp?: string | null,
  maxAgeSeconds: number = 300 // 5 minutes
): Promise<{ valid: boolean; error?: string }> {
  // Check if signature is provided
  if (!signature) {
    return { valid: false, error: "Missing webhook signature" };
  }

  // Check timestamp for replay attack prevention
  if (timestamp) {
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestampNum;

    if (isNaN(timestampNum)) {
      return { valid: false, error: "Invalid timestamp format" };
    }

    if (age > maxAgeSeconds) {
      return { valid: false, error: "Webhook timestamp too old" };
    }

    if (age < -60) {
      // Allow 1 minute clock skew into the future
      return { valid: false, error: "Webhook timestamp in the future" };
    }

    // Include timestamp in payload for signature verification
    // This prevents an attacker from replaying old valid signatures
    payload = `${timestamp}.${payload}`;
  }

  // Generate expected signature
  const expectedSignature = await generateSignature(payload, secret);

  // Handle different signature formats (with or without prefix)
  const cleanSignature = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  // Timing-safe comparison
  if (!timingSafeEqual(cleanSignature.toLowerCase(), expectedSignature.toLowerCase())) {
    return { valid: false, error: "Invalid webhook signature" };
  }

  return { valid: true };
}

/**
 * Middleware-style webhook verification for Edge Functions
 * @param req - The incoming request
 * @param secret - The webhook secret key
 * @returns Object with valid boolean, payload if valid, or error response
 */
export async function verifyWebhookRequest(
  req: Request,
  secret: string
): Promise<{ valid: true; payload: string } | { valid: false; response: Response }> {
  const signature = req.headers.get("x-webhook-signature") ||
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-signature");
  const timestamp = req.headers.get("x-webhook-timestamp") ||
    req.headers.get("x-timestamp");

  const payload = await req.text();

  const result = await verifyWebhookSignature(payload, signature, secret, timestamp);

  if (!result.valid) {
    console.error("Webhook verification failed:", result.error);
    return {
      valid: false,
      response: new Response(
        JSON.stringify({ error: "Unauthorized", message: result.error }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { valid: true, payload };
}

/**
 * Simple secret comparison (legacy support for basic webhooks)
 * Uses timing-safe comparison
 * @param provided - The secret provided in the request
 * @param expected - The expected secret
 * @returns true if secrets match
 */
export function verifySecret(provided: string | null, expected: string): boolean {
  if (!provided) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
