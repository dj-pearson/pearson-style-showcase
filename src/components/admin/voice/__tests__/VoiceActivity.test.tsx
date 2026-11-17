import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});
vi.mock('@/lib/edge-functions', () => ({
  invokeEdgeFunction: vi.fn(),
}));

import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { VoiceActivity } from '../VoiceActivity';

const mock = supabase as unknown as SupabaseMock;
const invoke = vi.mocked(invokeEdgeFunction);

function post(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    track: 'eatpal',
    product: 'eatpal',
    run_date: '2026-11-17',
    topic_id: null,
    format: 'text_carousel',
    status: 'posted',
    copy: {
      x: 'Short take for X.',
      threads: 'Threads take.',
      linkedin: 'LinkedIn take.',
      instagram: { caption: 'Instagram caption.', hashtags: ['arfid', '#pickyeating'] },
      facebook: 'Facebook take.',
      youtube: { title: 'Video title', description: 'Video description.' },
    },
    slides: [{ role: 'hook', headline: 'Hook' }],
    image_urls: ['https://example.com/1.png', 'https://example.com/2.png'],
    video_url: 'https://example.com/video.mp4',
    skip_reason: null,
    skip_stage: null,
    attempts: 1,
    dry_run: false,
    notified_at: null,
    created_at: '2026-11-17T18:15:00.000Z',
    updated_at: '2026-11-17T18:16:00.000Z',
    ...overrides,
  };
}

const skipped = post({
  id: 'post-2',
  track: 'platform',
  product: 'brikly',
  status: 'skipped',
  format: null,
  copy: null,
  slides: null,
  image_urls: [],
  video_url: null,
  skip_reason: 'unsourced claim: "my daughter now eats 14 foods"',
  skip_stage: 'check',
});

const log = [
  {
    id: 'l1',
    post_id: 'post-1',
    platform: 'instagram',
    variant: 'post',
    attempt: 1,
    http_status: 500,
    ok: false,
    response_excerpt: 'scenario error',
    payload: null,
    created_at: '2026-11-17T18:15:10Z',
  },
  {
    id: 'l2',
    post_id: 'post-1',
    platform: 'instagram',
    variant: 'post',
    attempt: 2,
    http_status: 200,
    ok: true,
    response_excerpt: 'Accepted',
    payload: null,
    created_at: '2026-11-17T18:15:45Z',
  },
  {
    id: 'l3',
    post_id: 'post-1',
    platform: 'instagram',
    variant: 'reel',
    attempt: 1,
    http_status: 200,
    ok: true,
    response_excerpt: 'Accepted',
    payload: null,
    created_at: '2026-11-17T18:15:50Z',
  },
];

beforeEach(() => {
  mock.from.mockClear();
  invoke.mockReset();
  mock.resetTableResults();
  mock.setTableResult('voice_posts', { data: [post(), skipped], error: null });
  mock.setTableResult('voice_webhook_log', { data: log, error: null });
});

const rowFor = (text: RegExp) => screen.getByText(text).closest('li') as HTMLElement;

describe('VoiceActivity', () => {
  it('shows a skipped row with the stage and reason, without expanding it', async () => {
    render(<VoiceActivity />);
    await waitFor(() => expect(screen.getByText(/2026-11-17 Platform/)).toBeInTheDocument());

    const row = rowFor(/2026-11-17 Platform/);
    expect(within(row).getByText('Skipped')).toBeInTheDocument();
    expect(
      within(row).getByText('Stopped at check: unsourced claim: "my daughter now eats 14 foods"')
    ).toBeInTheDocument();
    // The posted row carries no skip text.
    expect(within(rowFor(/2026-11-17 EatPal/)).queryByText(/Stopped at/)).not.toBeInTheDocument();
  });

  it('expands a posted row to its slides, video, captions and platform log', async () => {
    render(<VoiceActivity />);
    await waitFor(() => expect(screen.getByText(/2026-11-17 EatPal/)).toBeInTheDocument());
    const row = rowFor(/2026-11-17 EatPal/);
    expect(within(row).getByText('Posted')).toBeInTheDocument();
    expect(within(row).queryByText('Webhook log')).not.toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { expanded: false }));

    expect(within(row).getByAltText('Slide 2 of 2')).toHaveAttribute(
      'src',
      'https://example.com/2.png'
    );
    expect(row.querySelector('video')).toHaveAttribute('src', 'https://example.com/video.mp4');
    expect(within(row).getByText('Short take for X.')).toBeInTheDocument();
    expect(within(row).getByText(/Instagram caption\.\s+#arfid #pickyeating/)).toBeInTheDocument();
    expect(within(row).getByText(/Video title/)).toBeInTheDocument();

    await waitFor(() => expect(within(row).getByText('HTTP 500 failed')).toBeInTheDocument());
    expect(within(row).getByText('scenario error')).toBeInTheDocument();
    expect(within(row).getAllByText('HTTP 200 accepted')).toHaveLength(2);
    expect(within(row).getByText('Instagram (reel)')).toBeInTheDocument();
  });

  it('badges dry runs, including the dry_run status, and reads a null status as not sent', async () => {
    mock.setTableResult('voice_posts', {
      data: [
        post({ id: 'post-3', status: 'dry_run', dry_run: true }),
        post({ id: 'post-4', track: 'gradethread', status: 'rendering', dry_run: true }),
      ],
      error: null,
    });
    mock.setTableResult('voice_webhook_log', {
      data: [
        {
          ...log[0],
          id: 'l9',
          post_id: 'post-3',
          // As services/voice-engine/src/dispatch.ts writes a dry run: attempt 0.
          attempt: 0,
          http_status: null,
          ok: false,
          response_excerpt: 'dry run: not sent',
        },
      ],
      error: null,
    });
    render(<VoiceActivity />);
    await waitFor(() => expect(screen.getByText(/2026-11-17 EatPal/)).toBeInTheDocument());

    const done = rowFor(/2026-11-17 EatPal/);
    expect(within(done).getAllByText('Dry run')).toHaveLength(1);
    const inFlight = rowFor(/2026-11-17 GradeThread/);
    expect(within(inFlight).getByText('Rendering')).toBeInTheDocument();
    expect(within(inFlight).getByText('Dry run')).toBeInTheDocument();

    fireEvent.click(within(done).getByRole('button', { expanded: false }));
    await waitFor(() => expect(within(done).getByText('not sent (dry run)')).toBeInTheDocument());
  });

  it('runs a dry run straight away and asks before a real post', async () => {
    invoke.mockResolvedValue({ data: { accepted: true, track: 'eatpal' }, error: null });
    render(<VoiceActivity />);
    await waitFor(() => expect(screen.getByText(/2026-11-17 EatPal/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Dry run: EatPal' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('voice-run-now', {
        body: { track: 'eatpal', dryRun: true },
      })
    );

    invoke.mockClear();
    fireEvent.click(screen.getByRole('switch', { name: 'Dry run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Post now: EatPal' }));
    expect(await screen.findByText('Post EatPal for real?')).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Post now' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('voice-run-now', {
        body: { track: 'eatpal', dryRun: false },
      })
    );
  });

  it('pushes a finished dry-run post for real after asking, and offers nothing on a skipped or posted one', async () => {
    const dry = post({ id: 'post-3', track: 'gradethread', product: 'gradethread', status: 'dry_run', dry_run: true });
    mock.setTableResult('voice_posts', { data: [dry, post(), skipped], error: null });
    invoke.mockImplementation(async (_name, opts) => {
      const body = (opts as { body?: Record<string, unknown> }).body ?? {};
      return body.status === true
        ? { data: { ok: true, dryRun: false, version: '0.1.0' }, error: null }
        : { data: { accepted: true }, error: null };
    });
    render(<VoiceActivity />);
    await waitFor(() => expect(screen.getByText(/2026-11-17 GradeThread/)).toBeInTheDocument());

    for (const label of [/2026-11-17 EatPal/, /2026-11-17 Platform/]) {
      const row = rowFor(label);
      fireEvent.click(within(row).getByRole('button', { expanded: false }));
      expect(within(row).queryByRole('button', { name: 'Push to webhooks' })).not.toBeInTheDocument();
    }

    const row = rowFor(/2026-11-17 GradeThread/);
    fireEvent.click(within(row).getByRole('button', { expanded: false }));
    fireEvent.click(await within(row).findByRole('button', { name: 'Push to webhooks' }));
    expect(await screen.findByText(/for real\?/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith('voice-run-now', { body: { push: 'post-3' } });

    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Push to webhooks' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('voice-run-now', { body: { push: 'post-3' } })
    );
  });

  it('hides Push while the service runs in dry-run mode', async () => {
    const dry = post({ id: 'post-3', track: 'gradethread', product: 'gradethread', status: 'dry_run', dry_run: true });
    mock.setTableResult('voice_posts', { data: [dry], error: null });
    invoke.mockImplementation(async () => ({ data: { ok: true, dryRun: true, version: '0.1.0' }, error: null }));
    render(<VoiceActivity />);
    expect(await screen.findByText('Real posts are off')).toBeInTheDocument();

    const row = rowFor(/2026-11-17 GradeThread/);
    fireEvent.click(within(row).getByRole('button', { expanded: false }));
    expect(within(row).queryByRole('button', { name: 'Push to webhooks' })).not.toBeInTheDocument();
  });

  it('locks the switch to dry run and says why when the service runs in dry-run mode', async () => {
    invoke.mockImplementation(async (_name, opts) => {
      const body = (opts as { body?: Record<string, unknown> }).body ?? {};
      return body.status === true
        ? { data: { ok: true, dryRun: true, version: '0.1.0' }, error: null }
        : { data: { accepted: true }, error: null };
    });
    render(<VoiceActivity />);

    expect(await screen.findByText('Real posts are off')).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Dry run' });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Dry run: EatPal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post now: EatPal' })).not.toBeInTheDocument();
  });

  it('keeps the switch usable and says so when the mode cannot be read', async () => {
    invoke.mockImplementation(async (_name, opts) => {
      const body = (opts as { body?: Record<string, unknown> }).body ?? {};
      return body.status === true
        ? { data: null, error: new Error('Could not reach the voice engine') }
        : { data: { accepted: true }, error: null };
    });
    render(<VoiceActivity />);

    expect(await screen.findByText(/Could not read the voice engine's mode/)).toBeInTheDocument();
    expect(screen.queryByText('Real posts are off')).not.toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Dry run' });
    expect(toggle).not.toBeDisabled();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Post now: EatPal' })).toBeInTheDocument();
  });
});
