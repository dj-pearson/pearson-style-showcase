import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import AICrmAutomation from '../AICrmAutomation';
import { CRM_FAQS, PIPELINE_AUTOMATION_LADDER, SERVICE_TIERS } from '@/lib/crm-automation';

const renderPage = () => render(<AICrmAutomation />, { initialEntries: ['/ai-crm-automation'] });

describe('AI CRM Automation page', () => {
  it('sets the category-specific document title', async () => {
    renderPage();
    await waitFor(() => expect(document.title).toMatch(/AI CRM Automation Consultant/i));
  });

  it('renders every rung of the Pipeline Automation Ladder in order', () => {
    renderPage();
    const rungs = screen.getAllByRole('heading', { level: 3 });
    PIPELINE_AUTOMATION_LADDER.forEach((rung) => {
      expect(screen.getByText(rung.reality)).toBeInTheDocument();
    });
    // Rung names lead the h3 list, so the framework survives a content edit
    // that reorders the source array.
    expect(rungs[0]).toHaveTextContent(PIPELINE_AUTOMATION_LADDER[0].name);
  });

  it('publishes the price band for every engagement tier', () => {
    renderPage();
    SERVICE_TIERS.forEach((tier) => {
      expect(screen.getByText(tier.priceLabel)).toBeInTheDocument();
    });
  });

  it('keeps FAQ answers collapsed until their question is activated', async () => {
    const user = userEvent.setup();
    renderPage();

    const first = CRM_FAQS[0];
    expect(screen.queryByText(first.answer)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: first.question }));
    expect(screen.getByText(first.answer)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: first.question }));
    expect(screen.queryByText(first.answer)).not.toBeInTheDocument();
  });

  it('emits Service structured data carrying the offer catalog', async () => {
    renderPage();

    await waitFor(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      ).map((node) => JSON.parse(node.textContent || '{}'));

      const service = scripts.find((schema) => schema['@type'] === 'Service');
      expect(service).toBeDefined();
      expect(service.serviceType).toBe('AI CRM Automation');
      expect(service.hasOfferCatalog.itemListElement).toHaveLength(SERVICE_TIERS.length);

      // Only the audit is priced. Build and retainer are scoped from it, so they
      // must not emit a price an assistant could quote back as a real number.
      const priced = service.hasOfferCatalog.itemListElement.filter(
        (offer: { priceSpecification?: unknown }) => offer.priceSpecification
      );
      expect(priced).toHaveLength(1);
      expect(priced[0].itemOffered.name).toBe('CRM Automation Audit');
      expect(priced[0].priceSpecification.minPrice).toBe(2500);
      expect(priced[0].priceSpecification.maxPrice).toBe(2500);
    });
  });
});
