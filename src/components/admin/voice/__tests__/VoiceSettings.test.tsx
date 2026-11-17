import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';
import { callsTo, buildersFor } from './helpers';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});
vi.mock('@/lib/edge-functions', () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { VoiceSettings } from '../VoiceSettings';

const mock = supabase as unknown as SupabaseMock;
const invoke = vi.mocked(invokeEdgeFunction);

const tracks = [
  {
    key: 'platform',
    enabled: true,
    post_time: '16:30:00',
    timezone: 'America/Chicago',
    products: ['brikly', 'printyx', 'agentbio'],
    rotation_index: 1,
    updated_at: '',
  },
  {
    key: 'gradethread',
    enabled: true,
    post_time: '08:30:00',
    timezone: 'America/Chicago',
    products: ['gradethread'],
    rotation_index: 0,
    updated_at: '',
  },
  {
    key: 'eatpal',
    enabled: true,
    post_time: '12:15:00',
    timezone: 'America/Chicago',
    products: ['eatpal'],
    rotation_index: 0,
    updated_at: '',
  },
];
const targets = ['x', 'linkedin', 'instagram', 'facebook', 'threads', 'youtube'].map(
  (platform) => ({
    platform,
    url: platform === 'instagram' ? 'https://hook.us1.make.com/abc' : '',
    enabled: false,
    reels: false,
    updated_at: '',
  })
);

beforeEach(() => {
  mock.from.mockClear();
  invoke.mockReset();
  mock.resetTableResults();
  mock.setTableResult('voice_tracks', { data: tracks, error: null });
  mock.setTableResult('voice_webhook_targets', { data: targets, error: null });
});

/** The .eq() arguments of the builder whose update() was called on `table`. */
function updateTarget(table: string): unknown[] {
  const builder = buildersFor(mock, table).find((b) => b.update.mock.calls.length > 0);
  return builder ? builder.eq.mock.calls[0] : [];
}

describe('VoiceSettings', () => {
  it('saves a changed post time to that track only', async () => {
    render(<VoiceSettings />);
    const time = await screen.findByLabelText(/Post time/, {
      selector: '#voice-track-time-eatpal',
    });
    expect(time).toHaveValue('12:15');
    const save = screen.getByRole('button', { name: 'Save EatPal post time' });
    expect(save).toBeDisabled();

    fireEvent.change(time, { target: { value: '13:05' } });
    fireEvent.click(save);

    await waitFor(() => expect(callsTo(mock, 'voice_tracks', 'update')).toHaveLength(1));
    expect(callsTo(mock, 'voice_tracks', 'update')[0][0]).toEqual({ post_time: '13:05' });
    expect(updateTarget('voice_tracks')).toEqual(['key', 'eatpal']);
  });

  it('toggles a platform on', async () => {
    render(<VoiceSettings />);
    const toggle = await screen.findByRole('switch', { name: 'LinkedIn enabled' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    await waitFor(() => expect(callsTo(mock, 'voice_webhook_targets', 'update')).toHaveLength(1));
    expect(callsTo(mock, 'voice_webhook_targets', 'update')[0][0]).toEqual({ enabled: true });
    expect(updateTarget('voice_webhook_targets')).toEqual(['platform', 'linkedin']);
  });

  it('offers the reels toggle for Instagram only', async () => {
    render(<VoiceSettings />);
    await screen.findByRole('switch', { name: 'Instagram enabled' });
    expect(screen.getAllByLabelText('Also send the video as a Reel')).toHaveLength(1);
  });

  it('reorders the platform rotation with the up button', async () => {
    render(<VoiceSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Move Printyx up' }));

    await waitFor(() => expect(callsTo(mock, 'voice_tracks', 'update')).toHaveLength(1));
    expect(callsTo(mock, 'voice_tracks', 'update')[0][0]).toEqual({
      products: ['printyx', 'brikly', 'agentbio'],
    });
    expect(screen.getByRole('button', { name: 'Move Brikly up' })).toBeDisabled();
  });

  it('test fires a saved webhook and shows the HTTP status', async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: 200 }, error: null });
    render(<VoiceSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Test fire Instagram' }));

    await waitFor(() =>
      expect(screen.getByText('Webhook answered HTTP 200. Nothing was posted.')).toBeVisible()
    );
    expect(invoke).toHaveBeenCalledWith('voice-test-webhook', { body: { platform: 'instagram' } });
    // No URL saved: nothing to fire at.
    expect(screen.getByRole('button', { name: 'Test fire LinkedIn' })).toBeDisabled();
  });

  it('shows a failing webhook status as a failure', async () => {
    invoke.mockResolvedValue({ data: { ok: false, status: 410 }, error: null });
    render(<VoiceSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Test fire Instagram' }));
    await waitFor(() => expect(screen.getByText('Webhook answered HTTP 410.')).toBeVisible());
  });
});
