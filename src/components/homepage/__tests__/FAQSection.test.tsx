import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import FAQSection from '../FAQSection';

const mock = supabase as unknown as SupabaseMock;

const faqs = [
  {
    id: 'a',
    question: 'How long does setup take?',
    answer: 'About two weeks.',
    category: 'x',
    display_order: 1,
  },
  {
    id: 'b',
    question: 'Which CRMs?',
    answer: 'HubSpot and Salesforce.',
    category: 'x',
    display_order: 2,
  },
];

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('faqs', { data: faqs, error: null });
});

describe('FAQSection', () => {
  it('puts each question button inside its heading, not the other way round', async () => {
    render(<FAQSection />);

    const heading = await screen.findByRole('heading', {
      level: 3,
      name: 'How long does setup take?',
    });
    const button = screen.getByRole('button', { name: 'How long does setup take?' });
    expect(heading).toContainElement(button);
    expect(button.querySelector('h3')).toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens a labelled region the button controls', async () => {
    const user = userEvent.setup();
    render(<FAQSection />);

    const button = await screen.findByRole('button', { name: 'How long does setup take?' });
    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region', { name: 'How long does setup take?' });
    expect(button).toHaveAttribute('aria-controls', region.id);
    expect(region).toHaveTextContent('About two weeks.');
  });

  it('hides the chevron from assistive tech', async () => {
    render(<FAQSection />);
    const button = await screen.findByRole('button', { name: 'Which CRMs?' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
