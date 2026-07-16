import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});
// Avoid real network side effects from indexing notifications / edge functions.
vi.mock('@/services/google-indexing', () => ({
  notifyArticleUpdated: vi.fn().mockResolvedValue(undefined),
  notifyArticleDeleted: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/edge-functions', () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { supabase } from '@/integrations/supabase/client';
import { ArticleManager } from '../ArticleManager';

const mock = supabase as unknown as SupabaseMock;

function article(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    title: 'My First Post',
    slug: 'my-first-post',
    excerpt: 'An excerpt',
    content: '# hello',
    published: true,
    tags: ['news'],
    category: 'General',
    author: 'Dan',
    image_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('article_categories', { data: [], error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ArticleManager', () => {
  it('renders the article list', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    render(<ArticleManager />);
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());
  });

  it('shows an empty state when there are no articles', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    render(<ArticleManager />);
    await waitFor(() => expect(screen.getByText('No articles found')).toBeInTheDocument());
  });

  it('opens the create dialog with an empty title (create form)', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    render(<ArticleManager />);
    await waitFor(() => expect(screen.getByText('No articles found')).toBeInTheDocument());

    // There are two "New Article" affordances; click the first button.
    fireEvent.click(screen.getAllByRole('button', { name: /New Article/i })[0]);

    await waitFor(() => expect(screen.getByText('Create New Article')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Enter article title')).toHaveValue('');
  });

  it('populates the edit dialog with the selected article fields', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    render(<ArticleManager />);
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit article' }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Enter article title')).toHaveValue('My First Post')
    );
  });

  it('asks for confirmation before deleting an article', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ArticleManager />);
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete article' }));

    expect(confirmSpy).toHaveBeenCalled();
    // With confirm declined, the article remains in the list.
    expect(screen.getByText('My First Post')).toBeInTheDocument();
  });
});
