import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import Search, { resultHref, sortByRelevance } from '../Search';

const mock = supabase as unknown as SupabaseMock;

type SearchResultForTest = Parameters<typeof sortByRelevance>[0][number];

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

    await waitFor(() => expect(screen.getByText(/No results found for/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
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
    await waitFor(() => expect(screen.getByText(/No results found for/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });
});

describe('sortByRelevance', () => {
  const make = (over: Partial<SearchResultForTest>): SearchResultForTest => ({
    id: Math.random().toString(),
    type: 'article',
    title: 'untitled',
    ...over,
  });

  it('puts an exact title match ahead of a partial one', () => {
    const sorted = sortByRelevance(
      [make({ title: 'React patterns' }), make({ title: 'React' })],
      'react'
    );
    expect(sorted.map((r) => r.title)).toEqual(['React', 'React patterns']);
  });

  it('ranks title matches above body-only matches', () => {
    const sorted = sortByRelevance(
      [make({ title: 'Unrelated', excerpt: 'all about react' }), make({ title: 'React basics' })],
      'react'
    );
    expect(sorted.map((r) => r.title)).toEqual(['React basics', 'Unrelated']);
  });

  it('breaks ties by type, articles first', () => {
    const sorted = sortByRelevance(
      [
        make({ type: 'ai_tool', title: 'React tool' }),
        make({ type: 'project', title: 'React project' }),
        make({ type: 'article', title: 'React article' }),
      ],
      'react'
    );
    expect(sorted.map((r) => r.type)).toEqual(['article', 'project', 'ai_tool']);
  });
});

describe('search result links', () => {
  it('renders each result as a list item with a real link on the title', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    mock.setTableResult('projects', {
      data: [
        { id: 'p9', title: 'React Scheduler', description: 'x', image_url: null, status: null },
      ],
      error: null,
    });
    mock.setTableResult('ai_tools', { data: [], error: null });

    render(<Search />, { initialEntries: ['/search?q=react'] });

    const link = await screen.findByRole('link', { name: 'React Scheduler' }, { timeout: 3000 });
    expect(link).toHaveAttribute('href', '/projects?highlight=p9');
    expect(link.closest('li')).not.toBeNull();
  });

  it('routes each result type to a working destination', () => {
    expect(resultHref({ id: '1', type: 'article', title: 'a', slug: 'x' })).toEqual({
      href: '/news/x',
      external: false,
    });
    expect(
      resultHref({ id: '2', type: 'ai_tool', title: 't', url: 'https://tool.example' })
    ).toEqual({ href: 'https://tool.example', external: true });
    expect(resultHref({ id: '3', type: 'ai_tool', title: 't' })).toEqual({
      href: '/ai-tools',
      external: false,
    });
  });
});
