-- Lock down SECURITY DEFINER write RPCs.
--
-- Postgres grants EXECUTE on new functions to PUBLIC, so anyone holding the
-- anon key could call these through PostgREST and write straight into audit
-- and metrics tables (the definer bypasses RLS):
--
--   log_admin_activity        -> admin_activity_log (forged audit entries)
--   record_metric             -> system_metrics
--   log_ticket_activity       -> ticket_activity_log
--   record_maintenance_run    -> maintenance_results, maintenance_tasks
--   trigger_maintenance_scheduler -> fires maintenance-runner with the
--                                    service-role key
--
-- Callers checked before revoking: none of these is called from src/ with a
-- user JWT. maintenance-runner calls record_maintenance_run with the service
-- role; trigger_maintenance_scheduler is run by pg_cron as the owner. So all
-- five go to service_role only.
--
-- upsert_trusted_device / revoke_trusted_device are called from the browser
-- (src/lib/device-trust.ts) and stay granted to authenticated, but took
-- _user_id on trust: any signed-in user could trust a device for, or revoke
-- one from, another account. They now refuse a _user_id that is not the
-- caller's own, unless the caller is the service role.

DO $grants$
DECLARE
  fn REGPROCEDURE;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'log_admin_activity',
        'record_metric',
        'log_ticket_activity',
        'record_maintenance_run',
        'trigger_maintenance_scheduler'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $grants$;

-- Recreated with the same signatures so existing grants are kept.
CREATE OR REPLACE FUNCTION public.upsert_trusted_device(
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
SET search_path = public
AS $$
DECLARE
    _device_id UUID;
    _expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
       AND _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

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

CREATE OR REPLACE FUNCTION public.revoke_trusted_device(
    _device_id UUID,
    _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _success BOOLEAN := FALSE;
BEGIN
    IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
       AND _user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

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

-- Same as 20251209000001: anon never needed these.
REVOKE EXECUTE ON FUNCTION public.upsert_trusted_device(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_trusted_device(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_trusted_device(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_trusted_device(UUID, UUID) TO authenticated, service_role;
