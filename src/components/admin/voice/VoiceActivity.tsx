import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Loader2, Play, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  VOICE_IN_FLIGHT_STATUSES,
  VOICE_PLATFORMS,
  VOICE_PLATFORM_LABELS,
  VOICE_PRODUCT_LABELS,
  VOICE_TRACKS,
  VOICE_TRACK_LABELS,
  labelFor,
} from '@/components/admin/voice/constants';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';
import { isMfaRequiredError } from '@/lib/mfa-assurance';

type Post = Tables<'voice_posts'>;
type LogRow = Tables<'voice_webhook_log'>;

/** voice_posts.copy as the service writes it. Every field may be missing on a skipped post. */
interface PostCopy {
  x?: string;
  threads?: string;
  linkedin?: string;
  instagram?: { caption?: string; hashtags?: string[] };
  facebook?: string;
  youtube?: { title?: string; description?: string };
}

const POSTS_KEY = ['voice-posts'];
const LOG_KEY = ['voice-webhook-log'];
const HISTORY_DAYS = 30;
const POLL_MS = 5000;
/** How long to keep polling after Post now, while the new row has yet to appear. */
const POLL_AFTER_TRIGGER_MS = 90_000;

const FORMAT_LABELS: Record<string, string> = {
  text_carousel: 'Text carousel',
  single_image: 'Single image',
  product_carousel: 'Product carousel',
};

const STATUS_LABELS: Record<string, string> = {
  claimed: 'Claimed',
  writing: 'Writing',
  rendering: 'Rendering',
  dispatching: 'Sending',
  posted: 'Posted',
  partial: 'Partly posted',
  skipped: 'Skipped',
  failed: 'Failed',
  dry_run: 'Dry run',
};

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'posted') return 'default';
  if (status === 'failed' || status === 'skipped') return 'destructive';
  if (status === 'partial') return 'secondary';
  return 'outline';
};

const captionFor = (copy: PostCopy, platform: string): string | null => {
  switch (platform) {
    case 'instagram': {
      const caption = copy.instagram?.caption;
      if (!caption) return null;
      const tags = (copy.instagram?.hashtags ?? []).map((t) => (t.startsWith('#') ? t : `#${t}`));
      return tags.length ? `${caption}\n\n${tags.join(' ')}` : caption;
    }
    case 'youtube': {
      const { title, description } = copy.youtube ?? {};
      if (!title && !description) return null;
      return [title, description].filter(Boolean).join('\n\n');
    }
    case 'x':
      return copy.x ?? null;
    case 'threads':
      return copy.threads ?? null;
    case 'linkedin':
      return copy.linkedin ?? null;
    case 'facebook':
      return copy.facebook ?? null;
    default:
      return null;
  }
};

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

interface PostRowProps {
  post: Post;
  log: LogRow[];
}

const PostRow = ({ post, log }: PostRowProps) => {
  const [open, setOpen] = useState(false);
  const copy = (post.copy ?? {}) as PostCopy;
  const trackLabel = labelFor(VOICE_TRACK_LABELS, post.track);
  const isDryRun = post.dry_run || post.status === 'dry_run';
  const panelId = `voice-post-${post.id}`;
  const captions = VOICE_PLATFORMS.map((p) => ({ platform: p, text: captionFor(copy, p) })).filter(
    (c) => c.text
  );

  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[44px] w-full items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">
              {post.run_date} {trackLabel}
            </span>
            <Badge variant={statusVariant(post.status)}>
              {STATUS_LABELS[post.status] ?? post.status}
            </Badge>
            {isDryRun && post.status !== 'dry_run' && <Badge variant="outline">Dry run</Badge>}
          </span>
          <span className="block text-xs text-muted-foreground">
            {labelFor(VOICE_PRODUCT_LABELS, post.product)}
            {post.format ? `, ${FORMAT_LABELS[post.format] ?? post.format}` : ''}
            {`, ${formatDateTime(post.created_at)}`}
          </span>
          {post.skip_reason && (
            <span className="block text-sm text-destructive">
              {post.skip_stage ? `Stopped at ${post.skip_stage}: ` : ''}
              {post.skip_reason}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div id={panelId} className="mt-3 space-y-4 pl-6">
          {post.image_urls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Slides</h4>
              <ul className="flex gap-2 overflow-x-auto pb-2">
                {post.image_urls.map((url, index) => (
                  <li key={url} className="shrink-0">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Slide ${index + 1} of ${post.image_urls.length}`}
                        loading="lazy"
                        className="h-48 w-auto rounded border border-border"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {post.video_url && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Video</h4>
              {/* Slides and music only; the captions are the slide text itself. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                controls
                preload="none"
                src={post.video_url}
                className="max-h-96 w-full max-w-[216px] rounded border border-border"
              />
            </div>
          )}

          {captions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Captions</h4>
              <dl className="space-y-3">
                {captions.map((c) => (
                  <div key={c.platform}>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {VOICE_PLATFORM_LABELS[c.platform]}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-sm">{c.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Webhook log</h4>
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing was sent for this post.</p>
            ) : (
              <ul className="space-y-1">
                {log.map((row) => (
                  <li key={row.id} className="text-sm">
                    <span className="font-medium">
                      {labelFor(VOICE_PLATFORM_LABELS, row.platform)}
                      {row.variant === 'reel' ? ' (reel)' : ''}
                    </span>
                    {`, attempt ${row.attempt}: `}
                    <span className={row.ok ? '' : 'text-muted-foreground'}>
                      {row.http_status === null
                        ? 'not sent (dry run)'
                        : `HTTP ${row.http_status} ${row.ok ? 'accepted' : 'failed'}`}
                    </span>
                    {!row.ok && row.http_status !== null && row.response_excerpt && (
                      <span className="block break-words text-xs text-muted-foreground">
                        {row.response_excerpt}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

/**
 * The last 30 days of posts: what went out, what was skipped and why, and a
 * Post now button per track.
 */
export const VoiceActivity = () => {
  const queryClient = useQueryClient();
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [confirmTrack, setConfirmTrack] = useState<string | null>(null);
  const [pollUntil, setPollUntil] = useState(0);

  const postsQuery = useQuery({
    queryKey: POSTS_KEY,
    queryFn: async () => {
      const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('voice_posts')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as Post[];
      const inFlight = rows.some((p) => VOICE_IN_FLIGHT_STATUSES.includes(p.status));
      return inFlight || Date.now() < pollUntil ? POLL_MS : false;
    },
  });

  const posts = postsQuery.data ?? [];
  const postIds = posts.map((p) => p.id);

  const logQuery = useQuery({
    queryKey: [...LOG_KEY, postIds.join(',')],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_webhook_log')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const logByPost = new Map<string, LogRow[]>();
  for (const row of logQuery.data ?? []) {
    const list = logByPost.get(row.post_id) ?? [];
    list.push(row);
    logByPost.set(row.post_id, list);
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    queryClient.invalidateQueries({ queryKey: LOG_KEY });
  };

  const runTrack = async (track: string, asDryRun: boolean) => {
    setRunning(track);
    const { error } = await invokeEdgeFunction('voice-run-now', {
      body: { track, dryRun: asDryRun },
    });
    setRunning(null);

    const label = labelFor(VOICE_TRACK_LABELS, track);
    if (error) {
      logger.error('Voice post now failed:', error);
      toast.error(
        isMfaRequiredError(error)
          ? 'Post now needs a two-factor sign-in. Sign in again with your authenticator code.'
          : `${label} did not start: ${error.message}`
      );
      return;
    }
    toast.success(
      asDryRun ? `${label} dry run started` : `${label} is posting. Watch the list below.`
    );
    setPollUntil(Date.now() + POLL_AFTER_TRIGGER_MS);
    refresh();
  };

  const handlePostNow = (track: string) => {
    if (dryRun) {
      void runTrack(track, true);
    } else {
      setConfirmTrack(track);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Post now</CardTitle>
          <CardDescription>
            Run a track right away. A dry run writes and renders the post but sends nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-[44px] items-center gap-3">
            <Switch id="voice-dry-run" checked={dryRun} onCheckedChange={setDryRun} />
            <Label htmlFor="voice-dry-run">Dry run</Label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {VOICE_TRACKS.map((track) => (
              <Button
                key={track}
                variant={dryRun ? 'outline' : 'default'}
                disabled={running !== null}
                onClick={() => handlePostNow(track)}
              >
                {running === track ? <Loader2 className="animate-spin" /> : <Play />}
                {dryRun ? 'Dry run' : 'Post now'}: {VOICE_TRACK_LABELS[track]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Last {HISTORY_DAYS} days</CardTitle>
              <CardDescription>Newest first. Open a row for slides and captions.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={postsQuery.isFetching}
              aria-label="Refresh activity"
            >
              <RefreshCw className={postsQuery.isFetching ? 'animate-spin' : undefined} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {postsQuery.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading activity...
            </p>
          )}
          {postsQuery.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load activity: {(postsQuery.error as Error).message}
            </p>
          )}
          {logQuery.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load the webhook log: {(logQuery.error as Error).message}
            </p>
          )}
          {!postsQuery.isLoading && !postsQuery.error && posts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No posts in the last {HISTORY_DAYS} days.
            </p>
          )}
          <ul className="divide-y divide-border">
            {posts.map((post) => (
              <PostRow key={post.id} post={post} log={logByPost.get(post.id) ?? []} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmTrack} onOpenChange={(open) => !open && setConfirmTrack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Post {confirmTrack ? labelFor(VOICE_TRACK_LABELS, confirmTrack) : ''} for real?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This writes a post and sends it to every enabled platform under your name. It also
              uses up today's post for this track.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const track = confirmTrack;
                setConfirmTrack(null);
                if (track) void runTrack(track, false);
              }}
            >
              Post now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
