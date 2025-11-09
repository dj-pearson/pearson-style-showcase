-- Proactive Maintenance Automation Schema: Scheduled tasks, link monitoring, and performance tracking

-- Maintenance tasks configuration and scheduling
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text NOT NULL UNIQUE,
  task_type text NOT NULL, -- 'link_check', 'db_cleanup', 'performance_audit', 'image_optimization', 'sitemap_generation'
  description text,
  schedule_cron text NOT NULL, -- Cron expression (e.g., '0 2 * * *' for 2am daily)
  enabled boolean DEFAULT true,

  -- Execution tracking
  last_run_at timestamptz,
  last_run_status text, -- 'success', 'failed', 'running', 'cancelled'
  last_run_duration integer, -- Milliseconds
  last_run_output jsonb,
  next_run_at timestamptz,

  -- Configuration
  config jsonb DEFAULT '{}'::jsonb, -- Task-specific configuration

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Maintenance task execution history
CREATE TABLE IF NOT EXISTS public.maintenance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL, -- 'success', 'failed', 'cancelled'
  duration integer, -- Milliseconds

  -- Results
  issues_found integer DEFAULT 0,
  issues_fixed integer DEFAULT 0,
  items_processed integer DEFAULT 0,
  details jsonb DEFAULT '{}'::jsonb,
  error_message text,

  -- Alerts generated
  alerts_created integer DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link health tracking (broken link detection)
CREATE TABLE IF NOT EXISTS public.link_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  kb_article_id uuid REFERENCES public.kb_articles(id) ON DELETE CASCADE,

  -- Health status
  status_code integer,
  is_broken boolean DEFAULT false,
  is_redirect boolean DEFAULT false,
  redirect_url text,
  response_time integer, -- Milliseconds

  -- Tracking
  last_checked_at timestamptz DEFAULT now(),
  first_broken_at timestamptz,
  consecutive_failures integer DEFAULT 0,

  -- Resolution
  fix_attempted boolean DEFAULT false,
  fix_applied_at timestamptz,
  fix_method text, -- 'auto_updated', 'manual', 'ignored'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(url, article_id)
);

-- Performance metrics history (Core Web Vitals tracking)
CREATE TABLE IF NOT EXISTS public.performance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL, -- 'lcp', 'fid', 'cls', 'fcp', 'ttfb', 'bundle_size'
  metric_value numeric NOT NULL,
  metric_unit text, -- 'ms', 'bytes', 'score'
  page_url text,
  device_type text, -- 'desktop', 'mobile'

  -- Thresholds
  is_good boolean, -- Meets "good" threshold
  threshold_good numeric,
  threshold_needs_improvement numeric,

  -- Context
  user_agent text,
  connection_type text,

  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Database optimization tracking
CREATE TABLE IF NOT EXISTS public.db_optimization_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL, -- 'vacuum', 'analyze', 'reindex', 'cleanup'
  table_name text,

  -- Results
  rows_affected integer,
  space_freed_bytes bigint,
  duration integer, -- Milliseconds

  -- Details
  details jsonb DEFAULT '{}'::jsonb,

  executed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.db_optimization_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Maintenance tasks (admin only)
CREATE POLICY "Admins can manage maintenance tasks"
ON public.maintenance_tasks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Maintenance results (service write, admin read)
CREATE POLICY "Service can create maintenance results"
ON public.maintenance_results
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read maintenance results"
ON public.maintenance_results
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete old maintenance results"
ON public.maintenance_results
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Link health (service write, admin read/update)
CREATE POLICY "Service can manage link health"
ON public.link_health
FOR ALL
WITH CHECK (true);

CREATE POLICY "Admins can read link health"
ON public.link_health
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: Performance history (service write, admin read)
CREATE POLICY "Service can create performance history"
ON public.performance_history
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read performance history"
ON public.performance_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: DB optimization log (service write, admin read)
CREATE POLICY "Service can create db optimization logs"
ON public.db_optimization_log
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read db optimization logs"
ON public.db_optimization_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_maintenance_tasks_enabled ON public.maintenance_tasks(enabled) WHERE enabled = true;
CREATE INDEX idx_maintenance_tasks_next_run ON public.maintenance_tasks(next_run_at);
CREATE INDEX idx_maintenance_results_task_id ON public.maintenance_results(task_id);
CREATE INDEX idx_maintenance_results_run_at ON public.maintenance_results(run_at DESC);
CREATE INDEX idx_maintenance_results_status ON public.maintenance_results(status);

CREATE INDEX idx_link_health_broken ON public.link_health(is_broken) WHERE is_broken = true;
CREATE INDEX idx_link_health_article_id ON public.link_health(article_id);
CREATE INDEX idx_link_health_last_checked ON public.link_health(last_checked_at DESC);
CREATE INDEX idx_link_health_url ON public.link_health(url);

CREATE INDEX idx_performance_history_metric ON public.performance_history(metric_name);
CREATE INDEX idx_performance_history_recorded ON public.performance_history(recorded_at DESC);
CREATE INDEX idx_performance_history_page ON public.performance_history(page_url);

CREATE INDEX idx_db_optimization_log_executed ON public.db_optimization_log(executed_at DESC);
CREATE INDEX idx_db_optimization_log_operation ON public.db_optimization_log(operation_type);

-- Triggers for updated_at
CREATE TRIGGER update_maintenance_tasks_updated_at
BEFORE UPDATE ON public.maintenance_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_link_health_updated_at
BEFORE UPDATE ON public.link_health
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate next run time from cron expression (simplified)
CREATE OR REPLACE FUNCTION calculate_next_run(cron_expr text, from_time timestamptz DEFAULT now())
RETURNS timestamptz AS $$
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
$$ LANGUAGE plpgsql;

-- Function to record maintenance task execution
CREATE OR REPLACE FUNCTION record_maintenance_run(
  p_task_id uuid,
  p_status text,
  p_duration integer,
  p_issues_found integer DEFAULT 0,
  p_issues_fixed integer DEFAULT 0,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_error_message text DEFAULT NULL
) RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update link health
CREATE OR REPLACE FUNCTION update_link_health(
  p_url text,
  p_article_id uuid,
  p_status_code integer,
  p_response_time integer,
  p_redirect_url text DEFAULT NULL
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Insert default maintenance tasks
INSERT INTO public.maintenance_tasks (task_name, task_type, description, schedule_cron, enabled, config) VALUES
('Daily Link Health Check', 'link_check', 'Check all article links for broken URLs', '0 2 * * *', true, '{"timeout": 10000, "user_agent": "Mozilla/5.0 (compatible; LinkChecker/1.0)"}'::jsonb),
('Cleanup Old Sessions', 'db_cleanup', 'Remove admin sessions older than 30 days', '0 3 * * *', true, '{"retention_days": 30}'::jsonb),
('Weekly Performance Audit', 'performance_audit', 'Analyze Core Web Vitals and page performance', '0 4 * * 0', true, '{"pages": ["homepage", "blog", "ai-tools"]}'::jsonb),
('Monthly Database Optimization', 'db_cleanup', 'Vacuum and analyze database tables', '0 0 1 * *', true, '{"tables": ["articles", "projects", "ai_tools"]}'::jsonb),
('Daily Sitemap Generation', 'sitemap_generation', 'Regenerate sitemap.xml with latest content', '0 5 * * *', true, '{}'::jsonb);

-- Update next_run_at for all tasks
UPDATE public.maintenance_tasks
SET next_run_at = calculate_next_run(schedule_cron, now())
WHERE next_run_at IS NULL;

-- Comments on tables
COMMENT ON TABLE public.maintenance_tasks IS 'Scheduled maintenance tasks configuration';
COMMENT ON TABLE public.maintenance_results IS 'Historical record of maintenance task executions';
COMMENT ON TABLE public.link_health IS 'Broken link detection and monitoring';
COMMENT ON TABLE public.performance_history IS 'Core Web Vitals and performance metrics over time';
COMMENT ON TABLE public.db_optimization_log IS 'Database maintenance operation history';
