import { describe, it, expect, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { render, screen } from '@/test/test-utils';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import TopicHub from '../TopicHub';

describe('TopicHub page', () => {
  it('renders the 404 page for an unknown topic instead of redirecting', () => {
    render(
      <Routes>
        <Route path="/topics/:topic" element={<TopicHub />} />
        <Route path="/news" element={<p>news listing</p>} />
      </Routes>,
      { initialEntries: ['/topics/not-a-real-topic'] }
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.queryByText('news listing')).not.toBeInTheDocument();
  });
});
