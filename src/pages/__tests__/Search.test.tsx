import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import Search from '../Search';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
});

describe('Search page', () => {
  it('renders the search input', () => {
    render(<Search />, { initialEntries: ['/search'] });
    expect(
      screen.getByPlaceholderText('Search for articles, projects, AI tools...')
    ).toBeInTheDocument();
  });

  it('displays results for a query', async () => {
    mock.setTableResult('articles', {
      data: [
        {
          id: 'a1',
          title: 'React Automation Guide',
          excerpt: 'x',
          slug: 'react-guide',
          category: 'AI',
          tags: [],
          image_url: null,
        },
      ],
      error: null,
    });
    mock.setTableResult('projects', { data: [], error: null });
    mock.setTableResult('ai_tools', { data: [], error: null });

    render(<Search />, { initialEntries: ['/search?q=react'] });

    // Search is debounced ~300ms, so wait for the result to appear.
    await waitFor(() => expect(screen.getByText('React Automation Guide')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('shows an empty state when there are no results', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    mock.setTableResult('projects', { data: [], error: null });
    mock.setTableResult('ai_tools', { data: [], error: null });

    render(<Search />, { initialEntries: ['/search?q=zzzznomatch'] });

    await waitFor(
      () => expect(screen.getByText(/No results found for/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });

  it('handles a search query error without crashing', async () => {
    mock.setTableResult('articles', { data: null, error: { message: 'db down' } });
    mock.setTableResult('projects', { data: null, error: { message: 'db down' } });
    mock.setTableResult('ai_tools', { data: null, error: { message: 'db down' } });

    render(<Search />, { initialEntries: ['/search?q=react'] });

    // The page swallows query errors (logs them) and still renders the input +
    // an empty result set.
    expect(
      screen.getByPlaceholderText('Search for articles, projects, AI tools...')
    ).toBeInTheDocument();
    await waitFor(
      () => expect(screen.getByText(/No results found for/i)).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});
