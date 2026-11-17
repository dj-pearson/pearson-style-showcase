import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
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

type Track = Tables<'voice_tracks'>;
type Target = Tables<'voice_webhook_targets'>;

const TRACKS_KEY = ['voice-tracks'];
const TARGETS_KEY = ['voice-webhook-targets'];

/** Postgres returns time as HH:MM:SS; the time input wants HH:MM. */
const toTimeInput = (value: string): string => value.slice(0, 5);

const byOrder =
  <T,>(order: readonly string[], key: (row: T) => string) =>
  (a: T, b: T) =>
    order.indexOf(key(a)) - order.indexOf(key(b));

interface TestResult {
  ok: boolean;
  text: string;
}

interface TrackRowProps {
  track: Track;
  saving: boolean;
  onSave: (key: string, patch: Partial<Track>) => void;
}

const TrackRow = ({ track, saving, onSave }: TrackRowProps) => {
  const [time, setTime] = useState(toTimeInput(track.post_time));
  useEffect(() => setTime(toTimeInput(track.post_time)), [track.post_time]);

  const label = labelFor(VOICE_TRACK_LABELS, track.key);
  const dirty = time !== toTimeInput(track.post_time);
  const timeId = `voice-track-time-${track.key}`;
  const enabledId = `voice-track-enabled-${track.key}`;

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <Label htmlFor={enabledId} className="text-base font-medium">
          {label}
        </Label>
        <Switch
          id={enabledId}
          checked={track.enabled}
          disabled={saving}
          onCheckedChange={(checked) => onSave(track.key, { enabled: checked })}
          aria-label={`${label} track enabled`}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={timeId} className="text-xs text-muted-foreground">
            Post time ({track.timezone})
          </Label>
          <Input
            id={timeId}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-36"
          />
        </div>
        <Button
          variant="outline"
          disabled={!dirty || !time || saving}
          onClick={() => onSave(track.key, { post_time: time })}
          aria-label={`Save ${label} post time`}
        >
          Save time
        </Button>
      </div>
    </li>
  );
};

interface TargetRowProps {
  target: Target;
  saving: boolean;
  testing: boolean;
  testResult?: TestResult;
  onSave: (platform: string, patch: Partial<Target>) => void;
  onTest: (platform: string) => void;
}

const TargetRow = ({ target, saving, testing, testResult, onSave, onTest }: TargetRowProps) => {
  const [url, setUrl] = useState(target.url);
  useEffect(() => setUrl(target.url), [target.url]);

  const label = labelFor(VOICE_PLATFORM_LABELS, target.platform);
  const trimmed = url.trim();
  const dirty = trimmed !== target.url;
  const urlProblem =
    trimmed && !/^https:\/\/\S+$/i.test(trimmed) ? 'Webhook URLs must start with https://' : null;
  const urlId = `voice-target-url-${target.platform}`;
  const enabledId = `voice-target-enabled-${target.platform}`;
  const reelsId = `voice-target-reels-${target.platform}`;

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <Label htmlFor={enabledId} className="text-base font-medium">
          {label}
        </Label>
        <Switch
          id={enabledId}
          checked={target.enabled}
          disabled={saving}
          onCheckedChange={(checked) => onSave(target.platform, { enabled: checked })}
          aria-label={`${label} enabled`}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={urlId} className="text-xs text-muted-foreground">
          Make webhook URL
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={urlId}
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hook.us1.make.com/..."
            aria-invalid={urlProblem ? true : undefined}
            className="min-w-0 flex-1"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!dirty || !!urlProblem || saving}
              onClick={() => onSave(target.platform, { url: trimmed })}
              aria-label={`Save ${label} webhook URL`}
            >
              Save URL
            </Button>
            <Button
              variant="outline"
              disabled={!target.url || dirty || testing}
              onClick={() => onTest(target.platform)}
              aria-label={`Test fire ${label}`}
            >
              {testing ? <Loader2 className="animate-spin" /> : <Send />}
              Test fire
            </Button>
          </div>
        </div>
        {urlProblem && (
          <p role="alert" className="text-sm text-destructive">
            {urlProblem}
          </p>
        )}
        {testResult && (
          <p
            role="status"
            className={testResult.ok ? 'text-sm text-foreground' : 'text-sm text-destructive'}
          >
            {testResult.text}
          </p>
        )}
      </div>

      {target.platform === 'instagram' && (
        <div className="flex min-h-[44px] items-center justify-between gap-3">
          <Label htmlFor={reelsId} className="text-sm">
            Also send the video as a Reel
          </Label>
          <Switch
            id={reelsId}
            checked={target.reels}
            disabled={saving}
            onCheckedChange={(checked) => onSave(target.platform, { reels: checked })}
          />
        </div>
      )}
    </li>
  );
};

/**
 * When each track posts, the platform-track rotation, and where each platform's
 * post is sent. Everything saves straight to voice_tracks and
 * voice_webhook_targets; the service reads them on its next tick.
 */
export const VoiceSettings = () => {
  const queryClient = useQueryClient();
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const tracksQuery = useQuery({
    queryKey: TRACKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_tracks').select('*');
      if (error) throw error;
      return ((data ?? []) as Track[]).sort(byOrder(VOICE_TRACKS, (t) => t.key));
    },
  });

  const targetsQuery = useQuery({
    queryKey: TARGETS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('voice_webhook_targets').select('*');
      if (error) throw error;
      return ((data ?? []) as Target[]).sort(byOrder(VOICE_PLATFORMS, (t) => t.platform));
    },
  });

  const saveTrack = useMutation({
    mutationFn: async (input: { key: string; patch: Partial<Track> }) => {
      const { error } = await supabase
        .from('voice_tracks')
        .update(input.patch)
        .eq('key', input.key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Track saved');
      queryClient.invalidateQueries({ queryKey: TRACKS_KEY });
    },
    onError: (error: Error) => {
      logger.error('Voice track save failed:', error);
      toast.error(`Could not save the track: ${error.message}`);
    },
  });

  const saveTarget = useMutation({
    mutationFn: async (input: { platform: string; patch: Partial<Target> }) => {
      const { error } = await supabase
        .from('voice_webhook_targets')
        .update(input.patch)
        .eq('platform', input.platform);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Platform saved');
      queryClient.invalidateQueries({ queryKey: TARGETS_KEY });
    },
    onError: (error: Error) => {
      logger.error('Voice webhook target save failed:', error);
      toast.error(`Could not save the platform: ${error.message}`);
    },
  });

  const handleTest = async (platform: string) => {
    setTestingPlatform(platform);
    const { data, error } = await invokeEdgeFunction<{ ok: boolean; status: number }>(
      'voice-test-webhook',
      { body: { platform } }
    );
    setTestingPlatform(null);

    let result: TestResult;
    if (error) {
      logger.error('Voice test fire failed:', error);
      result = {
        ok: false,
        text: isMfaRequiredError(error)
          ? 'Test fire needs a two-factor sign-in. Sign in again with your authenticator code.'
          : `Test fire failed: ${error.message}`,
      };
    } else if (data?.ok) {
      result = { ok: true, text: `Webhook answered HTTP ${data.status}. Nothing was posted.` };
    } else {
      result = { ok: false, text: `Webhook answered HTTP ${data?.status ?? 'unknown'}.` };
    }
    setTestResults((prev) => ({ ...prev, [platform]: result }));
  };

  const platformTrack = tracksQuery.data?.find((t) => t.key === 'platform');
  const rotation = platformTrack?.products ?? [];

  const moveProduct = (index: number, delta: number) => {
    const next = [...rotation];
    const swapWith = index + delta;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    saveTrack.mutate({ key: 'platform', patch: { products: next } });
  };

  const loading = (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
    </p>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tracks</CardTitle>
          <CardDescription>
            One post per track per day. A track that is off is skipped without an email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tracksQuery.isLoading && loading}
          {tracksQuery.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load tracks: {(tracksQuery.error as Error).message}
            </p>
          )}
          <ul className="divide-y divide-border">
            {(tracksQuery.data ?? []).map((track) => (
              <TrackRow
                key={track.key}
                track={track}
                saving={saveTrack.isPending}
                onSave={(key, patch) => saveTrack.mutate({ key, patch })}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      {platformTrack && (
        <Card>
          <CardHeader>
            <CardTitle>Platform track rotation</CardTitle>
            <CardDescription>
              The platform track covers one product a day in this order, and only moves on after a
              post goes out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-border">
              {rotation.map((product, index) => {
                const name = labelFor(VOICE_PRODUCT_LABELS, product);
                const isNext =
                  rotation.length > 0 && platformTrack.rotation_index % rotation.length === index;
                return (
                  <li key={product} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm">
                      {index + 1}. {name}
                      {isNext && <span className="text-muted-foreground"> (next up)</span>}
                    </span>
                    <span className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={index === 0 || saveTrack.isPending}
                        onClick={() => moveProduct(index, -1)}
                        aria-label={`Move ${name} up`}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={index === rotation.length - 1 || saveTrack.isPending}
                        onClick={() => moveProduct(index, 1)}
                        aria-label={`Move ${name} down`}
                      >
                        <ArrowDown />
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Platforms</CardTitle>
          <CardDescription>
            Each platform has its own Make scenario. Paste its webhook URL, then Test fire: the
            scenario should answer 200 and post nothing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {targetsQuery.isLoading && loading}
          {targetsQuery.error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load platforms: {(targetsQuery.error as Error).message}
            </p>
          )}
          <ul className="divide-y divide-border">
            {(targetsQuery.data ?? []).map((target) => (
              <TargetRow
                key={target.platform}
                target={target}
                saving={saveTarget.isPending}
                testing={testingPlatform === target.platform}
                testResult={testResults[target.platform]}
                onSave={(platform, patch) => saveTarget.mutate({ platform, patch })}
                onTest={handleTest}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
