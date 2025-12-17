-- Migration: Add trusted devices for "Remember this device" feature
-- This allows users to skip MFA on trusted devices

-- Create trusted_devices table
CREATE TABLE IF NOT EXISTS public.trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT, -- 'desktop', 'mobile', 'tablet'
    browser TEXT,
    operating_system TEXT,
    ip_address TEXT,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    trust_token TEXT UNIQUE NOT NULL,
    verification_method TEXT, -- 'mfa', 'password', 'oauth'
    CONSTRAINT unique_user_device UNIQUE (user_id, device_fingerprint)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON public.trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token ON public.trusted_devices(trust_token);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON public.trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_active ON public.trusted_devices(is_active, expires_at);

-- Create device trust events table for audit trail
CREATE TABLE IF NOT EXISTS public.device_trust_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.trusted_devices(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'trust_created', 'trust_used', 'trust_revoked', 'trust_expired', 'trust_rejected'
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for audit events
CREATE INDEX IF NOT EXISTS idx_device_trust_events_user_id ON public.device_trust_events(user_id);
CREATE INDEX IF NOT EXISTS idx_device_trust_events_device_id ON public.device_trust_events(device_id);
CREATE INDEX IF NOT EXISTS idx_device_trust_events_type ON public.device_trust_events(event_type);

-- Enable Row Level Security
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_trust_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trusted_devices
CREATE POLICY "Users can view their own trusted devices"
    ON public.trusted_devices
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trusted devices"
    ON public.trusted_devices
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trusted devices"
    ON public.trusted_devices
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trusted devices"
    ON public.trusted_devices
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policies for device_trust_events
CREATE POLICY "Users can view their own device trust events"
    ON public.device_trust_events
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert device trust events"
    ON public.device_trust_events
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Function to clean up expired trusted devices
CREATE OR REPLACE FUNCTION cleanup_expired_trusted_devices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark expired devices as inactive
    UPDATE public.trusted_devices
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;

    -- Delete devices that have been inactive for more than 90 days
    DELETE FROM public.trusted_devices
    WHERE is_active = FALSE
    AND expires_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Function to verify a trust token
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
        (d.id IS NOT NULL AND d.is_active AND d.expires_at > NOW()) as is_valid,
        d.id as device_id,
        d.device_name
    FROM public.trusted_devices d
    WHERE d.trust_token = _trust_token
    AND d.user_id = _user_id
    AND d.device_fingerprint = _device_fingerprint
    AND d.is_active = TRUE
    AND d.expires_at > NOW();
END;
$$;

-- Function to create or update a trusted device
CREATE OR REPLACE FUNCTION upsert_trusted_device(
    _user_id UUID,
    _device_fingerprint TEXT,
    _device_name TEXT,
    _device_type TEXT,
    _browser TEXT,
    _operating_system TEXT,
    _ip_address TEXT,
    _trust_token TEXT,
    _verification_method TEXT,
    _expires_in_days INTEGER DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _device_id UUID;
    _expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    _expires_at := NOW() + (_expires_in_days || ' days')::INTERVAL;

    INSERT INTO public.trusted_devices (
        user_id,
        device_fingerprint,
        device_name,
        device_type,
        browser,
        operating_system,
        ip_address,
        trust_token,
        verification_method,
        expires_at,
        last_used_at,
        is_active
    )
    VALUES (
        _user_id,
        _device_fingerprint,
        _device_name,
        _device_type,
        _browser,
        _operating_system,
        _ip_address,
        _trust_token,
        _verification_method,
        _expires_at,
        NOW(),
        TRUE
    )
    ON CONFLICT (user_id, device_fingerprint)
    DO UPDATE SET
        device_name = EXCLUDED.device_name,
        device_type = EXCLUDED.device_type,
        browser = EXCLUDED.browser,
        operating_system = EXCLUDED.operating_system,
        ip_address = EXCLUDED.ip_address,
        trust_token = EXCLUDED.trust_token,
        verification_method = EXCLUDED.verification_method,
        expires_at = EXCLUDED.expires_at,
        last_used_at = NOW(),
        is_active = TRUE
    RETURNING id INTO _device_id;

    -- Log the event
    INSERT INTO public.device_trust_events (
        user_id,
        device_id,
        event_type,
        ip_address,
        metadata
    )
    VALUES (
        _user_id,
        _device_id,
        'trust_created',
        _ip_address,
        jsonb_build_object(
            'device_name', _device_name,
            'verification_method', _verification_method,
            'expires_at', _expires_at
        )
    );

    RETURN _device_id;
END;
$$;

-- Function to revoke a trusted device
CREATE OR REPLACE FUNCTION revoke_trusted_device(
    _device_id UUID,
    _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _success BOOLEAN := FALSE;
BEGIN
    UPDATE public.trusted_devices
    SET is_active = FALSE
    WHERE id = _device_id
    AND user_id = _user_id
    RETURNING TRUE INTO _success;

    IF _success THEN
        INSERT INTO public.device_trust_events (
            user_id,
            device_id,
            event_type,
            metadata
        )
        VALUES (
            _user_id,
            _device_id,
            'trust_revoked',
            '{}'::jsonb
        );
    END IF;

    RETURN COALESCE(_success, FALSE);
END;
$$;

-- Function to update last used timestamp when device is verified
CREATE OR REPLACE FUNCTION update_device_last_used(
    _device_id UUID,
    _ip_address TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.trusted_devices
    SET
        last_used_at = NOW(),
        ip_address = COALESCE(_ip_address, ip_address)
    WHERE id = _device_id;

    -- Log usage event
    INSERT INTO public.device_trust_events (
        user_id,
        device_id,
        event_type,
        ip_address
    )
    SELECT
        user_id,
        id,
        'trust_used',
        _ip_address
    FROM public.trusted_devices
    WHERE id = _device_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_trusted_devices() TO service_role;
GRANT EXECUTE ON FUNCTION verify_trust_token(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_trusted_device(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_trusted_device(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_device_last_used(UUID, TEXT) TO service_role;

-- Add comment
COMMENT ON TABLE public.trusted_devices IS 'Stores trusted devices for MFA bypass feature';
COMMENT ON TABLE public.device_trust_events IS 'Audit trail for device trust operations';
