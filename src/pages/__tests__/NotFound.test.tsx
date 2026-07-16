import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

// Navigation queries Supabase on mount; a default mock is enough for it to render.
vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import NotFound from '../NotFound';

describe('NotFound page', () => {
  it('renders the 404 message', () => {
    render(<NotFound />, { initialEntries: ['/does-not-exist'] });
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('provides navigation back to home', () => {
    render(<NotFound />, { initialEntries: ['/does-not-exist'] });
    expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument();
  });
});
