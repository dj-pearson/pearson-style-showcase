import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import StructuredData from '@/components/SEO/StructuredData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  display_order: number;
}

const FAQSection = () => {
  // Fetch FAQs from database
  const { data: faqData = [], isLoading } = useQuery({
    queryKey: ['faqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('status', 'published')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as FAQItem[];
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  if (isLoading) {
    return (
      <section className="mobile-section mobile-container bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="h-10 w-72 bg-muted animate-pulse rounded mx-auto mb-4"></div>
            <div className="h-6 w-96 bg-muted animate-pulse rounded mx-auto"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (faqData.length === 0) {
    return null;
  }

  return (
    <section className="mobile-section mobile-container bg-muted/20">
      <StructuredData
        type="faq"
        data={{
          questions: faqData.map((item) => ({
            question: item.question,
            answer: item.answer,
          })),
        }}
      />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="mobile-heading-lg text-primary mb-4">Frequently Asked Questions</h2>
          <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
            Get answers to common questions about AI automation and implementation
          </p>
        </div>

        {/*
          Radix primitives rather than the shadcn AccordionTrigger: that one
          renders its chevron without aria-hidden and fixes the answer at
          text-sm. Radix supplies the <h3> wrapper, aria-expanded,
          aria-controls and the role="region" panel labelled by its button.
        */}
        <AccordionPrimitive.Root type="single" collapsible className="space-y-4">
          {faqData.map((faq) => (
            <AccordionPrimitive.Item
              key={faq.id}
              value={faq.id}
              className="overflow-hidden rounded-lg border bg-card text-card-foreground"
            >
              <AccordionPrimitive.Header asChild>
                <h3 className="text-lg font-semibold">
                  <AccordionPrimitive.Trigger className="group flex w-full items-start justify-between gap-4 p-6 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                    <span className="pr-8">{faq.question}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-primary"
                    />
                  </AccordionPrimitive.Trigger>
                </h3>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="px-6 pb-6 text-muted-foreground leading-relaxed">{faq.answer}</div>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>
      </div>
    </section>
  );
};

export default FAQSection;
