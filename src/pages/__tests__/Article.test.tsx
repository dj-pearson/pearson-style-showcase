import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { render, screen, waitFor, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});
vi.mock('@/integrations/supabase/public-client', () => import('@/test/mocks/public-client'));

// Spy on the generated article bundle so a test can tell whether the page
// downloaded it. The real lookup still runs.
vi.mock('@/content/crm-articles.generated', async () => {
  const actual = await vi.importActual<typeof import('@/content/crm-articles.generated')>(
    '@/content/crm-articles.generated'
  );
  return { ...actual, findStaticArticle: vi.fn(actual.findStaticArticle) };
});

import { supabase } from '@/integrations/supabase/client';
import { findStaticArticle } from '@/content/crm-articles.generated';
import {
  PRERENDER_DATA_ID,
  articlePrerenderKey,
  resetPrerenderDataCache,
} from '@/lib/prerenderData';
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
  vi.mocked(findStaticArticle).mockClear();
});

afterEach(() => {
  document.getElementById(PRERENDER_DATA_ID)?.remove();
  resetPrerenderDataCache();
});

function embedPrerenderData(slug: string, data: Record<string, unknown>) {
  const script = document.createElement('script');
  script.type = 'application/json';
  script.id = PRERENDER_DATA_ID;
  script.textContent = JSON.stringify({ key: articlePrerenderKey(slug), updatedAt: 0, data });
  document.body.appendChild(script);
}

describe('Article page', () => {
  it('renders the article content (title)', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    renderArticleAt('automating-with-ai');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /Automating Your Business with AI/i })
      ).toBeInTheDocument()
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

  it('offers a retry, not a not-found, when the fetch fails', async () => {
    mock.setTableResult('articles', { data: null, error: { message: 'network down' } });
    renderArticleAt('automating-with-ai');
    await waitFor(() => expect(screen.getByText(/didn't load/i)).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/Article Not Found/i)).not.toBeInTheDocument();
  });

  it('recovers when a retry succeeds', async () => {
    mock.setTableResult('articles', { data: null, error: { message: 'network down' } });
    renderArticleAt('automating-with-ai');
    const retry = await screen.findByRole('button', { name: /try again/i }, { timeout: 5000 });

    mock.setTableResult('articles', { data: articleFixture(), error: null });
    await userEvent.click(retry);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /Automating Your Business with AI/i })
      ).toBeInTheDocument()
    );
  });

  it('falls back to the prerendered markdown when the row is missing', async () => {
    // The live state of production for every CRM article (US-074): the page is
    // prerendered but the database has no row for it.
    mock.setTableResult('articles', { data: null, error: null });
    renderArticleAt('why-ai-crm-projects-fail');

    await waitFor(
      () =>
        expect(
          screen.getByRole('heading', { name: /Why AI CRM Projects Fail/i })
        ).toBeInTheDocument(),
      { timeout: 5000 }
    );
    expect(screen.queryByText(/Article Not Found/i)).not.toBeInTheDocument();
  });

  it('uses the embedded copy, not the generated bundle, when the row is missing', async () => {
    embedPrerenderData(
      'why-ai-crm-projects-fail',
      articleFixture({
        id: 'static-why-ai-crm-projects-fail',
        slug: 'why-ai-crm-projects-fail',
        title: 'Embedded Build Copy',
      })
    );
    mock.setTableResult('articles', { data: null, error: null });
    renderArticleAt('why-ai-crm-projects-fail');

    expect(
      await screen.findByRole('heading', { name: /Embedded Build Copy/i }, { timeout: 5000 })
    ).toBeInTheDocument();
    // Let the mount refetch settle before checking it did not fall back.
    await waitFor(() => expect(mock.from).toHaveBeenCalledWith('articles'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(findStaticArticle).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Embedded Build Copy/i })).toBeInTheDocument();
  });

  it('falls back to the prerendered markdown when the fetch fails', async () => {
    mock.setTableResult('articles', { data: null, error: { message: 'network down' } });
    renderArticleAt('why-ai-crm-projects-fail');

    await waitFor(
      () =>
        expect(
          screen.getByRole('heading', { name: /Why AI CRM Projects Fail/i })
        ).toBeInTheDocument(),
      { timeout: 5000 }
    );
    expect(screen.queryByText(/didn't load/i)).not.toBeInTheDocument();
  });

  it('still shows not-found for a slug with no prerendered copy', async () => {
    mock.setTableResult('articles', { data: null, error: null });
    renderArticleAt('does-not-exist-anywhere');
    await waitFor(() => expect(screen.getByText(/Article Not Found/i)).toBeInTheDocument());
  });

  it('injects structured data (JSON-LD) for the article', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    renderArticleAt('automating-with-ai');
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /Automating Your Business with AI/i })
      ).toBeInTheDocument()
    );
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });

  it('ends a CRM article with the audit offer', async () => {
    mock.setTableResult('articles', { data: articleFixture({ category: 'CRM' }), error: null });
    renderArticleAt('automating-with-ai');
    // Scope to the article ending: the site nav carries its own "Book an audit" link.
    const ending = await screen.findByRole('complementary', { name: 'What next' });
    const link = within(ending).getByRole('link', { name: 'Book an audit' });
    expect(link).toHaveAttribute('href', '/connect');
    expect(screen.queryByText('The pipeline notes')).not.toBeInTheDocument();
  });

  it('ends any other article with the newsletter', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    renderArticleAt('automating-with-ai');
    expect(await screen.findByText('The pipeline notes')).toBeInTheDocument();
    const ending = screen.getByRole('complementary', { name: 'What next' });
    expect(within(ending).queryByRole('link', { name: 'Book an audit' })).not.toBeInTheDocument();
  });

  it('shares LinkedIn, X and copy link in that order, with no Facebook', async () => {
    mock.setTableResult('articles', { data: articleFixture(), error: null });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    renderArticleAt('automating-with-ai');

    const group = await screen.findByRole('group', { name: 'Share this article' });
    const labels = Array.from(group.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels.slice(0, 3)).toEqual(['LinkedIn', 'X', 'Copy Link']);
    expect(screen.queryByText('Facebook')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /on LinkedIn/ }));
    const [shareUrl, target, features] = open.mock.calls[0];
    expect(decodeURIComponent(String(shareUrl))).toContain('utm_medium=share');
    expect(decodeURIComponent(String(shareUrl))).toContain('utm_source=linkedin');
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
    open.mockRestore();
  });
});
