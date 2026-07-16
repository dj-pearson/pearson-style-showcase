/**
 * Shared types for Supabase real-time (postgres_changes) channel payloads used
 * across the admin command-center components.
 *
 * These mirror the shape Supabase delivers to `.on('postgres_changes', ...)`
 * callbacks so handlers can be typed instead of using `any`.
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Minimal shape common to every realtime row. The index signature lets these
 * row types satisfy supabase-js's `{ [key: string]: any }` generic constraint
 * on RealtimePostgresChangesPayload.
 */
export interface RealtimeRow {
  id: string | number;
  [key: string]: unknown;
}

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * A postgres_changes payload, aliased to supabase-js's own payload type so
 * handlers stay compatible with `channel.on('postgres_changes', ...)`. On the
 * union, `new` is the row for INSERT/UPDATE (and `{}` for DELETE), so cast
 * `payload.new` to the concrete row type inside INSERT/UPDATE handlers.
 */
export type RealtimePayload<TRow extends RealtimeRow = RealtimeRow> =
  RealtimePostgresChangesPayload<TRow>;

// ---- Row shapes for the tables the activity feed / alerts subscribe to ----

export interface AffiliateClickRow extends RealtimeRow {
  asin?: string | null;
  clicked_at: string;
}

export interface NewsletterSubscriberRow extends RealtimeRow {
  email: string;
  subscribed_at: string;
}

export interface ContactSubmissionRow extends RealtimeRow {
  name?: string | null;
  subject?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
}

export interface ToolSubmissionRow extends RealtimeRow {
  tool_name?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
}

export interface AdminActionRow extends RealtimeRow {
  action?: string | null;
  action_category?: string | null;
  resource_title?: string | null;
  details?: string | null;
  admin_email?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
}
