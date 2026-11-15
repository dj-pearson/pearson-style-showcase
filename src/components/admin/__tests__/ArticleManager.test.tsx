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
import { ConfirmProvider } from '@/components/ui/confirm-dialog';

const mock = supabase as unknown as SupabaseMock;

// The admin dashboard mounts ConfirmProvider above every manager.
function renderManager() {
  return render(
    <ConfirmProvider>
      <ArticleManager />
    </ConfirmProvider>
  );
}

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
    renderManager();
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());
  });

  it('shows an empty state when there are no articles', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    renderManager();
    await waitFor(() => expect(screen.getByText('No articles found')).toBeInTheDocument());
  });

  it('opens the create dialog with an empty title (create form)', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    renderManager();
    await waitFor(() => expect(screen.getByText('No articles found')).toBeInTheDocument());

    // There are two "New Article" affordances; click the first button.
    fireEvent.click(screen.getAllByRole('button', { name: /New Article/i })[0]);

    await waitFor(() => expect(screen.getByText('Create New Article')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Enter article title')).toHaveValue('');
  });

  it('populates the edit dialog with the selected article fields', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    renderManager();
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit article' }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Enter article title')).toHaveValue('My First Post')
    );
  });

  it('loads the body before opening the editor, since the list does not carry it', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    renderManager();
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit article' }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText('Enter article title')).toHaveValue('My First Post')
    );
    // The editor binds to the refetched row, body included.
    expect(screen.getByDisplayValue('# hello')).toBeInTheDocument();
  });

  it('keeps the editor shut when the body cannot be loaded, rather than saving a blank over it', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    renderManager();
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());

    mock.setTableResult('articles', { data: null, error: { message: 'unreachable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit article' }));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Enter article title')).not.toBeInTheDocument()
    );
  });

  it('asks for confirmation, naming the article, and keeps it when cancelled', async () => {
    mock.setTableResult('articles', { data: [article()], error: null });
    const nativeConfirm = vi.spyOn(window, 'confirm');

    renderManager();
    await waitFor(() => expect(screen.getByText('My First Post')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete article' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete article "My First Post"?');
    expect(nativeConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    // With the dialog cancelled, nothing was deleted.
    expect(screen.getByText('My First Post')).toBeInTheDocument();
  });

  it('rolls back only the failed toggle, keeping a toggle that succeeded meanwhile', async () => {
    mock.setTableResult('articles', {
      data: [
        article({ id: 'a', title: 'Alpha', slug: 'alpha' }),
        article({ id: 'b', title: 'Beta', slug: 'beta' }),
      ],
      error: null,
    });
    renderManager();
    await waitFor(() => expect(screen.getByText('Beta')).toBeInTheDocument());

    // Hold Alpha's update open so Beta's toggle lands while it is in flight.
    let failAlpha: () => void = () => {};
    const pending = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      failAlpha = () => resolve({ data: null, error: { message: 'rls' } });
    });
    const held: Record<string, unknown> = {};
    held.update = () => held;
    held.eq = () => held;
    held.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      pending.then(ok, bad);
    mock.from.mockImplementationOnce(() => held as never);

    const switches = () => screen.getAllByRole('switch', { name: 'Toggle published status' });
    fireEvent.click(switches()[0]);
    await waitFor(() => expect(switches()[0]).not.toBeChecked());

    fireEvent.click(switches()[1]);
    await waitFor(() => expect(switches()[1]).not.toBeChecked());

    failAlpha();
    await waitFor(() => expect(switches()[0]).toBeChecked());
    expect(switches()[1]).not.toBeChecked();
  });
});
