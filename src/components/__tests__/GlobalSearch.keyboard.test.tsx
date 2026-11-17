import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});
vi.mock('@/integrations/supabase/public-client', () => import('@/test/mocks/public-client'));

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import { supabase as client } from '@/integrations/supabase/client';
import GlobalSearch from '../GlobalSearch';

const supabase = client as unknown as SupabaseMock;

const articles = [
  { id: '1', title: 'Crm alpha', excerpt: 'first', slug: 'crm-alpha', category: 'CRM', tags: [] },
  { id: '2', title: 'Crm beta', excerpt: 'second', slug: 'crm-beta', category: 'CRM', tags: [] },
];

describe('GlobalSearch keyboard selection', () => {
  beforeEach(() => {
    navigate.mockClear();
    supabase.setTableResult('articles', { data: articles, error: null });
    supabase.setTableResult('projects', { data: [], error: null });
    supabase.setTableResult('ai_tools', { data: [], error: null });
  });

  const open = async () => {
    const user = userEvent.setup();
    render(<GlobalSearch open onOpenChange={() => {}} />);
    await user.type(screen.getByRole('combobox'), 'crm alpha');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    return user;
  };

  it('opens the first result on Enter, which the footer has always promised', async () => {
    const user = await open();
    await user.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledWith('/news/crm-alpha');
  });

  it('moves the highlight with the arrow keys', async () => {
    const user = await open();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    );

    await user.keyboard('{Enter}');
    expect(navigate).toHaveBeenCalledWith('/news/crm-beta');
  });

  it('wraps from the last result back to the first', async () => {
    const user = await open();
    await user.keyboard('{ArrowUp}');
    await waitFor(() =>
      expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true')
    );
  });

  it('points the input at the highlighted option for screen readers', async () => {
    const user = await open();
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-activedescendant', 'global-search-result-0');
    await user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(input).toHaveAttribute('aria-activedescendant', 'global-search-result-1')
    );
  });
});

describe('GlobalSearch failure state', () => {
  beforeEach(() => {
    supabase.setTableResult('articles', { data: null, error: { message: 'boom' } });
    supabase.setTableResult('projects', { data: [], error: null });
    supabase.setTableResult('ai_tools', { data: [], error: null });
  });

  it('says the search failed, not that nothing matched, and offers a retry', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch open onOpenChange={() => {}} />);
    await user.type(screen.getByRole('combobox'), 'zzqxv');
    expect(await screen.findByText('Search failed. Try again.')).toBeInTheDocument();
    expect(screen.queryByText(/No results found/)).not.toBeInTheDocument();

    supabase.setTableResult('articles', { data: articles, error: null });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
  });

  it('labels the clear button', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch open onOpenChange={() => {}} />);
    await user.type(screen.getByRole('combobox'), 'x');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });
});
