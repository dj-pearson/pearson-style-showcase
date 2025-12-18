-- Add Slack integration fields to notification_settings table
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS slack_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS slack_webhook_url text,
ADD COLUMN IF NOT EXISTS slack_channel text DEFAULT '#emails';

-- Add comment for documentation
COMMENT ON COLUMN notification_settings.slack_enabled IS 'Whether Slack notifications are enabled';
COMMENT ON COLUMN notification_settings.slack_webhook_url IS 'Slack Incoming Webhook URL';
COMMENT ON COLUMN notification_settings.slack_channel IS 'Slack channel name (for display purposes)';

