import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@/test/test-utils';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

describe('useProfileSettings', () => {
  it('Navigation and Footer share one profile_settings request', async () => {
    const from = supabase.from as unknown as ReturnType<typeof vi.fn>;
    from.mockClear();

    render(
      <>
        <Navigation />
        <Footer />
      </>
    );

    await waitFor(() => {
      expect(from.mock.calls.filter((call) => call[0] === 'profile_settings')).toHaveLength(1);
    });
  });
});
