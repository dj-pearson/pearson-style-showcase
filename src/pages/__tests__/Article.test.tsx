import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import Article from '../Article';

const mock = supabase as unknown as SupabaseMock;

function articleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    title: 'Automating Your Business with AI',
    slug: 'automating-with-ai',
    excerpt: 'A practical guide.',
    content: '## Introduction\n\nThis is the **article body** in markdown.',
    category: 'AI Automation',
    author: 'Dan Pearson',
    tags: ['AI', 'automation'],
    image_url: null,
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    read_time: '5 min read',
    views: 10,
    published: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderArticleAt(slug: string) {
  return render(
    <Routes>
      <Route path="/news/:slug" element={<Article />} />
    </Routes>,
    { initialEntries: [`/news/${slug}`] }
  );
}

beforeEach(() => {
  mock.resetTableResults();
});

describe('Article page', () => {
  it('renders the article content (title)', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    renderArticleAt('automating-with-ai');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Automating Your Business with AI/i })).toBeInTheDocument()
    );
  });

  it('renders the markdown body', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    renderArticleAt('automating-with-ai');
    await waitFor(() => expect(screen.getByText(/article body/i)).toBeInTheDocument());
    // Markdown heading is rendered as an actual heading element.
    expect(screen.getByRole('heading', { name: /Introduction/i })).toBeInTheDocument();
  });

  it('shows a not-found state for a missing article', async () => {
    mock.setTableResult('articles', { data: null, error: null });
    renderArticleAt('does-not-exist');
    await waitFor(() => expect(screen.getByText(/Article Not Found/i)).toBeInTheDocument());
  });

  it('injects structured data (JSON-LD) for the article', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    renderArticleAt('automating-with-ai');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Automating Your Business with AI/i })).toBeInTheDocument()
    );
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });
});
