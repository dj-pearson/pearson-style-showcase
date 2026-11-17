import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';
import { callsTo } from './helpers';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { StoryBank } from '../StoryBank';

const mock = supabase as unknown as SupabaseMock;

function story(overrides: Record<string, unknown> = {}) {
  return {
    id: 'story-1',
    body: 'Tried tacos tonight, ate the shell only.',
    tracks: ['eatpal'],
    products: ['eatpal'],
    confirmed: true,
    source: 'manual',
    source_ref: null,
    times_used: 2,
    last_used_at: null,
    created_at: '2026-11-10T12:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mock.from.mockClear();
  mock.resetTableResults();
});

describe('StoryBank', () => {
  it('adds a story tagged to a track with source manual, then clears the form', async () => {
    mock.setTableResult('voice_stories', { data: [], error: null });
    render(<StoryBank />);
    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeInTheDocument());

    const textarea = screen.getByLabelText('Story');
    fireEvent.change(textarea, { target: { value: '  Closed a deal from a parking lot.  ' } });
    const trackGroup = screen.getByRole('group', { name: 'Tracks' });
    fireEvent.click(within(trackGroup).getByRole('button', { name: 'Platform' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save story' }));

    await waitFor(() => expect(callsTo(mock, 'voice_stories', 'insert')).toHaveLength(1));
    expect(callsTo(mock, 'voice_stories', 'insert')[0][0]).toEqual({
      body: 'Closed a deal from a parking lot.',
      tracks: ['platform'],
      products: [],
      source: 'manual',
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
    expect(within(trackGroup).getByRole('button', { name: 'Platform' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('refuses an empty story and writes nothing', async () => {
    mock.setTableResult('voice_stories', { data: [], error: null });
    render(<StoryBank />);
    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Save story' }));

    expect(await screen.findByText(/Write the story first/)).toBeInTheDocument();
    expect(callsTo(mock, 'voice_stories', 'insert')).toHaveLength(0);
  });

  it('filters the list by track and shows everything again when the filter is cleared', async () => {
    mock.setTableResult('voice_stories', {
      data: [
        story(),
        story({
          id: 'story-2',
          body: 'A reseller listed 40 items in one sitting.',
          tracks: ['gradethread'],
          products: ['gradethread'],
        }),
      ],
      error: null,
    });
    render(<StoryBank />);
    await waitFor(() => expect(screen.getByText(/ate the shell only/)).toBeInTheDocument());
    expect(screen.getByText(/40 items in one sitting/)).toBeInTheDocument();

    const filter = screen.getByRole('group', { name: 'Filter by track' });
    fireEvent.click(within(filter).getByRole('button', { name: 'GradeThread' }));
    expect(screen.queryByText(/ate the shell only/)).not.toBeInTheDocument();
    expect(screen.getByText(/40 items in one sitting/)).toBeInTheDocument();

    // Counter-check: the filter is what hid the row, not a broken list.
    fireEvent.click(within(filter).getByRole('button', { name: 'GradeThread' }));
    expect(screen.getByText(/ate the shell only/)).toBeInTheDocument();
  });

  it('shows usage and lets a story be unconfirmed', async () => {
    mock.setTableResult('voice_stories', { data: [story()], error: null });
    render(<StoryBank />);
    await waitFor(() => expect(screen.getByText(/Used 2 times, last used never/)).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'Unconfirm' }));
    await waitFor(() => expect(callsTo(mock, 'voice_stories', 'update')).toHaveLength(1));
    expect(callsTo(mock, 'voice_stories', 'update')[0][0]).toEqual({ confirmed: false });
  });
});
