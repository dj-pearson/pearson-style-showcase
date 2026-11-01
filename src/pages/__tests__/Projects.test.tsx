import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import Projects from '../Projects';

const mock = supabase as unknown as SupabaseMock;

// Twelve rows: more than one page of nine. Newest first, so p1 is on page 1
// and p12 (the oldest) lands on page 2 under the default sort.
const rows = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i + 1}`,
  title: `Project ${i + 1}`,
  description: i === 11 ? 'Fleet scheduling for plumbers' : 'A SaaS platform',
  image_url: null,
  live_link: null,
  github_link: null,
  tags: i === 11 ? ['logistics'] : ['saas'],
  featured: false,
  sort_order: i,
  created_at: new Date(Date.UTC(2025, 0, 30 - i)).toISOString(),
  status: null,
  updated_at: null,
}));

beforeEach(() => {
  mock.resetTableResults();
  localStorage.clear();
  mock.setTableResult('projects', { data: rows, error: null });
});

describe('Projects page', () => {
  it('paginates the full list client-side', async () => {
    render(<Projects />, { initialEntries: ['/projects'] });
    await screen.findByText('Project 1');
    expect(screen.queryByText('Project 12')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1-9 of 12 projects/)).toBeInTheDocument();
  });

  it('finds a project that sits on page 2 when searching', async () => {
    render(<Projects />, { initialEntries: ['/projects'] });
    await screen.findByText('Project 1');
    fireEvent.change(screen.getByLabelText('Search projects'), {
      target: { value: 'plumbers' },
    });
    expect(await screen.findByText('Project 12')).toBeInTheDocument();
    expect(screen.queryByText(/No projects match/)).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1-1 of 1 matching projects \(12 total\)/)).toBeInTheDocument();
  });

  it('jumps to the page holding ?highlight=<id> and marks it', async () => {
    render(<Projects />, { initialEntries: ['/projects?highlight=p12'] });
    const title = await screen.findByText('Project 12');
    await waitFor(() =>
      expect(title.closest('#project-p12')).toHaveAttribute('data-highlighted', 'true')
    );
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });
});
