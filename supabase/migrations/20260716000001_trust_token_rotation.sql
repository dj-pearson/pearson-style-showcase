-- Device trust hardening: token rotation (forward secrecy) and a sliding
-- inactivity window on verification.
--
-- Client changes (src/lib/device-trust.ts):
--   * Only a SHA-256 hash of the trust token is ever stored/transmitted.
--   * On every successful verification the client rotates the token via
--     rotate_trust_token below (atomic old -> new swap).
--   * Verification is rate-limited and tokens unused for 14 days are rejected.
--
-- These server-side changes make the same guarantees enforceable in the
-- database so a leaked-but-unrotated token cannot be replayed after inactivity.

-- Atomically swap a device's trust token to a new (hashed) value. Returns TRUE
-- only when the old token matched an active, unexpired record for the user +
-- fingerprint. This gives forward secrecy: the previous token is invalidated
-- the moment a new one is issued.
CREATE OR REPLACE FUNCTION rotate_trust_token(
    _old_trust_token TEXT,
    _new_trust_token TEXT,
    _user_id UUID,
    _device_fingerprint TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _rotated BOOLEAN := FALSE;
BEGIN
    UPDATE public.trusted_devices
    SET trust_token = _new_trust_token,
        last_used_at = NOW()
    WHERE trust_token = _old_trust_token
      AND user_id = _user_id
      AND device_fingerprint = _device_fingerprint
      AND is_active = TRUE
      AND expires_at > NOW()
    RETURNING TRUE INTO _rotated;

    RETURN COALESCE(_rotated, FALSE);
END;
$$;

-- Re-create verification with a sliding 14-day inactivity window in addition to
-- the absolute expires_at cap. A token not used within 14 days is treated as
-- invalid even if it has not yet reached its hard expiry.
CREATE OR REPLACE FUNCTION verify_trust_token(
    _trust_token TEXT,
    _user_id UUID,
    _device_fingerprint TEXT
)
RETURNS TABLE(
    is_valid BOOLEAN,
    device_id UUID,
    device_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (
            d.id IS NOT NULL
            AND d.is_active
            AND d.expires_at > NOW()
            AND d.last_used_at > NOW() - INTERVAL '14 days'
        ) AS is_valid,
        d.id AS device_id,
        d.device_name
    FROM public.trusted_devices d
    WHERE d.trust_token = _trust_token
      AND d.user_id = _user_id
      AND d.device_fingerprint = _device_fingerprint
      AND d.is_active = TRUE
      AND d.expires_at > NOW()
      AND d.last_used_at > NOW() - INTERVAL '14 days';
END;
$$;

GRANT EXECUTE ON FUNCTION rotate_trust_token(TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_trust_token(TEXT, UUID, TEXT) TO authenticated;
