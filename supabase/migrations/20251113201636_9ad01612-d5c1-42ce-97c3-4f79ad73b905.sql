-- Fix function search_path security warnings
-- This migration adds SET search_path to all functions that don't have it

-- Update has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- Update update_invoice_totals function
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  v_subtotal DECIMAL(15, 2);
  v_tax_amount DECIMAL(15, 2);
  v_discount_amount DECIMAL(15, 2);
  v_total DECIMAL(15, 2);
BEGIN
  -- Calculate totals from invoice items
  SELECT
    COALESCE(SUM(line_total - tax_amount - discount_amount), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(discount_amount), 0),
    COALESCE(SUM(line_total), 0)
  INTO v_subtotal, v_tax_amount, v_discount_amount, v_total
  FROM invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Update the invoice
  UPDATE invoices
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    discount_amount = v_discount_amount,
    total_amount = v_total,
    amount_due = v_total - amount_paid
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Update log_admin_activity function
CREATE OR REPLACE FUNCTION public.log_admin_activity(p_admin_email text, p_action text, p_action_category text DEFAULT NULL::text, p_resource_type text DEFAULT NULL::text, p_resource_id uuid DEFAULT NULL::uuid, p_resource_title text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.admin_activity_log (
    admin_id,
    admin_email,
    action,
    action_category,
    resource_type,
    resource_id,
    resource_title,
    metadata
  ) VALUES (
    auth.uid(),
    p_admin_email,
    p_action,
    p_action_category,
    p_resource_type,
    p_resource_id,
    p_resource_title,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- Update record_metric function
CREATE OR REPLACE FUNCTION public.record_metric(p_metric_type text, p_metric_name text, p_value numeric, p_unit text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO public.system_metrics (
    metric_type,
    metric_name,
    value,
    unit,
    metadata
  ) VALUES (
    p_metric_type,
    p_metric_name,
    p_value,
    p_unit,
    p_metadata
  )
  RETURNING id INTO v_metric_id;

  RETURN v_metric_id;
END;
$function$;

-- Update update_invoice_amount_paid function
CREATE OR REPLACE FUNCTION public.update_invoice_amount_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  v_amount_paid DECIMAL(15, 2);
  v_total_amount DECIMAL(15, 2);
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Calculate total allocated
  SELECT COALESCE(SUM(amount_allocated), 0)
  INTO v_amount_paid
  FROM payment_allocations
  WHERE invoice_id = v_invoice_id;

  -- Get total amount
  SELECT total_amount
  INTO v_total_amount
  FROM invoices
  WHERE id = v_invoice_id;

  -- Update invoice
  UPDATE invoices
  SET
    amount_paid = v_amount_paid,
    amount_due = v_total_amount - v_amount_paid,
    status = CASE
      WHEN v_amount_paid >= v_total_amount THEN 'paid'
      WHEN v_amount_paid > 0 THEN 'partially_paid'
      ELSE status
    END
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Update check_alert_rules function
CREATE OR REPLACE FUNCTION public.check_alert_rules()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_metric_value numeric;
  v_triggered boolean;
BEGIN
  -- Loop through all enabled alert rules
  FOR v_rule IN
    SELECT * FROM public.alert_rules
    WHERE enabled = true
  LOOP
    -- Calculate metric value based on time window
    SELECT
      CASE
        WHEN v_rule.metric_type = 'error_rate' THEN COUNT(*)
        WHEN v_rule.metric_type = 'api_latency' THEN AVG(value)
        ELSE AVG(value)
      END
    INTO v_metric_value
    FROM public.system_metrics
    WHERE
      metric_type = v_rule.metric_type
      AND recorded_at > now() - (v_rule.time_window_minutes || ' minutes')::interval;

    -- Check if threshold is crossed
    v_triggered := CASE v_rule.threshold_operator
      WHEN '>' THEN v_metric_value > v_rule.threshold_value
      WHEN '<' THEN v_metric_value < v_rule.threshold_value
      WHEN '>=' THEN v_metric_value >= v_rule.threshold_value
      WHEN '<=' THEN v_metric_value <= v_rule.threshold_value
      WHEN '=' THEN v_metric_value = v_rule.threshold_value
      ELSE false
    END;

    -- Create alert if triggered and not recently triggered (prevent spam)
    IF v_triggered AND (
      v_rule.last_triggered_at IS NULL OR
      v_rule.last_triggered_at < now() - interval '1 hour'
    ) THEN
      INSERT INTO public.automated_alerts (
        alert_rule_id,
        alert_type,
        severity,
        title,
        message,
        details
      ) VALUES (
        v_rule.id,
        v_rule.alert_type,
        v_rule.severity,
        v_rule.alert_name,
        format('Alert triggered: %s. Current value: %s, Threshold: %s %s',
          v_rule.description,
          v_metric_value,
          v_rule.threshold_operator,
          v_rule.threshold_value
        ),
        jsonb_build_object(
          'metric_value', v_metric_value,
          'threshold', v_rule.threshold_value,
          'time_window_minutes', v_rule.time_window_minutes
        )
      );

      -- Update last triggered time
      UPDATE public.alert_rules
      SET last_triggered_at = now()
      WHERE id = v_rule.id;
    END IF;
  END LOOP;
END;
$function$;

-- Update update_account_balance function
CREATE OR REPLACE FUNCTION public.update_account_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  v_balance DECIMAL(15, 2);
  v_account_id UUID;
BEGIN
  v_account_id := COALESCE(NEW.account_id, OLD.account_id);

  -- Calculate balance (debits increase assets/expenses, credits increase liabilities/income/equity)
  SELECT
    a.opening_balance + COALESCE(SUM(jel.debit - jel.credit), 0)
  INTO v_balance
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE a.id = v_account_id
    AND (je.status = 'posted' OR je.id IS NULL)
  GROUP BY a.id, a.opening_balance;

  -- Update account balance
  UPDATE accounts
  SET current_balance = v_balance
  WHERE id = v_account_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Update claim_amazon_throttle function
CREATE OR REPLACE FUNCTION public.claim_amazon_throttle(min_interval_ms integer DEFAULT 1000)
 RETURNS TABLE(wait_ms integer, used_today integer, day_key date)
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
declare
  now_ts timestamptz := now();
  lc timestamptz;
  u integer;
  d date;
  elapsed_ms integer := 0;
  intended_last timestamptz;
begin
  -- Ensure row exists
  insert into public.amazon_api_throttle (id) values (1)
  on conflict (id) do nothing;

  -- Lock row
  select last_call_at, used_today, day_key
    into lc, u, d
  from public.amazon_api_throttle
  where id = 1
  for update;

  -- Reset daily counters at day boundary
  if d is null or d <> current_date then
    u := 0;
    d := current_date;
  end if;

  if lc is not null then
    elapsed_ms := floor(extract(epoch from (now_ts - lc)) * 1000);
  end if;

  if elapsed_ms < min_interval_ms then
    wait_ms := min_interval_ms - elapsed_ms;
  else
    wait_ms := 0;
  end if;

  intended_last := now_ts + ((wait_ms::text || ' milliseconds')::interval);

  update public.amazon_api_throttle
    set last_call_at = intended_last,
        used_today = coalesce(u,0) + 1,
        day_key = d
    where id = 1;

  used_today := coalesce(u,0) + 1;
  day_key := d;

  return next;
end;
$function$;

-- Update update_ticket_last_activity function
CREATE OR REPLACE FUNCTION public.update_ticket_last_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.support_tickets
  SET last_activity_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$function$;

-- Update generate_ticket_number function
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  ticket_num text;
  ticket_count integer;
BEGIN
  -- Get count of existing tickets
  SELECT COUNT(*) INTO ticket_count FROM public.support_tickets;

  -- Generate ticket number with zero padding
  ticket_num := 'TICKET-' || LPAD((ticket_count + 1)::text, 6, '0');

  RETURN ticket_num;
END;
$function$;

-- Update set_ticket_number function
CREATE OR REPLACE FUNCTION public.set_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Update log_ticket_activity function
CREATE OR REPLACE FUNCTION public.log_ticket_activity(p_ticket_id uuid, p_actor_email text, p_action text, p_old_value text DEFAULT NULL::text, p_new_value text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.ticket_activity_log (
    ticket_id,
    actor_id,
    actor_email,
    action,
    old_value,
    new_value,
    metadata
  ) VALUES (
    p_ticket_id,
    auth.uid(),
    p_actor_email,
    p_action,
    p_old_value,
    p_new_value,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- Update increment_kb_helpful function
CREATE OR REPLACE FUNCTION public.increment_kb_helpful(article_id uuid, helpful boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  IF helpful THEN
    UPDATE public.kb_articles
    SET helpful_count = helpful_count + 1
    WHERE id = article_id;
  ELSE
    UPDATE public.kb_articles
    SET not_helpful_count = not_helpful_count + 1
    WHERE id = article_id;
  END IF;
END;
$function$;

-- Update increment_canned_response_usage function
CREATE OR REPLACE FUNCTION public.increment_canned_response_usage(response_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.canned_responses
  SET
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = response_id;
END;
$function$;

-- Update calculate_next_run function
CREATE OR REPLACE FUNCTION public.calculate_next_run(cron_expr text, from_time timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  next_run timestamptz;
BEGIN
  -- Simplified cron parsing - in production, use pg_cron or external scheduler
  -- For now, just add intervals based on common patterns
  CASE
    WHEN cron_expr = '0 2 * * *' THEN -- Daily at 2am
      next_run := date_trunc('day', from_time) + interval '1 day' + interval '2 hours';
    WHEN cron_expr = '0 * * * *' THEN -- Every hour
      next_run := date_trunc('hour', from_time) + interval '1 hour';
    WHEN cron_expr = '*/15 * * * *' THEN -- Every 15 minutes
      next_run := date_trunc('hour', from_time) +
                  (floor(extract(minute from from_time) / 15) + 1) * interval '15 minutes';
    WHEN cron_expr = '0 0 * * 0' THEN -- Weekly on Sunday at midnight
      next_run := date_trunc('week', from_time) + interval '1 week';
    WHEN cron_expr = '0 0 1 * *' THEN -- Monthly on 1st at midnight
      next_run := date_trunc('month', from_time) + interval '1 month';
    ELSE
      -- Default to next day
      next_run := from_time + interval '1 day';
  END CASE;

  -- Ensure next run is in the future
  IF next_run <= from_time THEN
    next_run := next_run + interval '1 day';
  END IF;

  RETURN next_run;
END;
$function$;

-- Update record_maintenance_run function
CREATE OR REPLACE FUNCTION public.record_maintenance_run(p_task_id uuid, p_status text, p_duration integer, p_issues_found integer DEFAULT 0, p_issues_fixed integer DEFAULT 0, p_details jsonb DEFAULT '{}'::jsonb, p_error_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_result_id uuid;
  v_task_name text;
BEGIN
  -- Get task name
  SELECT task_name INTO v_task_name FROM public.maintenance_tasks WHERE id = p_task_id;

  -- Insert result
  INSERT INTO public.maintenance_results (
    task_id,
    task_name,
    status,
    duration,
    issues_found,
    issues_fixed,
    details,
    error_message
  ) VALUES (
    p_task_id,
    v_task_name,
    p_status,
    p_duration,
    p_issues_found,
    p_issues_fixed,
    p_details,
    p_error_message
  )
  RETURNING id INTO v_result_id;

  -- Update task
  UPDATE public.maintenance_tasks
  SET
    last_run_at = now(),
    last_run_status = p_status,
    last_run_duration = p_duration,
    last_run_output = p_details,
    next_run_at = calculate_next_run(schedule_cron, now())
  WHERE id = p_task_id;

  RETURN v_result_id;
END;
$function$;

-- Update update_link_health function
CREATE OR REPLACE FUNCTION public.update_link_health(p_url text, p_article_id uuid, p_status_code integer, p_response_time integer, p_redirect_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
DECLARE
  v_is_broken boolean;
  v_is_redirect boolean;
BEGIN
  v_is_broken := p_status_code >= 400 OR p_status_code = 0;
  v_is_redirect := p_status_code >= 300 AND p_status_code < 400;

  INSERT INTO public.link_health (
    url,
    article_id,
    status_code,
    is_broken,
    is_redirect,
    redirect_url,
    response_time,
    consecutive_failures
  ) VALUES (
    p_url,
    p_article_id,
    p_status_code,
    v_is_broken,
    v_is_redirect,
    p_redirect_url,
    p_response_time,
    CASE WHEN v_is_broken THEN 1 ELSE 0 END
  )
  ON CONFLICT (url, article_id) DO UPDATE SET
    status_code = p_status_code,
    is_broken = v_is_broken,
    is_redirect = v_is_redirect,
    redirect_url = p_redirect_url,
    response_time = p_response_time,
    last_checked_at = now(),
    consecutive_failures = CASE
      WHEN v_is_broken THEN link_health.consecutive_failures + 1
      ELSE 0
    END,
    first_broken_at = CASE
      WHEN v_is_broken AND link_health.first_broken_at IS NULL THEN now()
      WHEN NOT v_is_broken THEN NULL
      ELSE link_health.first_broken_at
    END;
END;
$function$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;