import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import CategoryArchive from '../CategoryArchive';
import TagArchive from '../TagArchive';

const mock = supabase as unknown as SupabaseMock;

const robots = () => document.querySelector('meta[name="robots"]')?.getAttribute('content');
const canonical = () => document.querySelector('link[rel="canonical"]')?.getAttribute('href');

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('articles', { data: [], error: null });
});

describe('archive pages', () => {
  it('marks an empty category archive noindex', async () => {
    render(
      <Routes>
        <Route path="/news/category/:category" element={<CategoryArchive />} />
      </Routes>,
      { initialEntries: ['/news/category/no-such-category-xyz'] }
    );

    expect(await screen.findByText('No articles found')).toBeInTheDocument();
    await waitFor(() => expect(robots()).toBe('noindex, nofollow'));
  });

  it('normalises an escaped, mixed-case tag before building the canonical', async () => {
    render(
      <Routes>
        <Route path="/news/tag/:tag" element={<TagArchive />} />
      </Routes>,
      { initialEntries: ['/news/tag/Nothing%2520Tagged%2520Xyz'] }
    );

    await waitFor(() =>
      expect(canonical()).toBe('https://danpearson.net/news/tag/nothing-tagged-xyz')
    );
  });
});
