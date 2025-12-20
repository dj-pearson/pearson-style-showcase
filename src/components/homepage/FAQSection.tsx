import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
          questions: faqData.map(item => ({
            question: item.question,
            answer: item.answer
          }))
        }}
      />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="mobile-heading-lg text-primary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
            Get answers to common questions about AI automation and implementation
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <Card
              key={faq.id}
              className="overflow-hidden transition-all duration-200 hover:shadow-lg"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full text-left p-6 flex justify-between items-start gap-4 hover:bg-muted/50 transition-colors"
                aria-expanded={openIndex === index}
              >
                <h3 className="text-lg font-semibold pr-8">
                  {faq.question}
                </h3>
                <div className="flex-shrink-0 mt-1">
                  {openIndex === index ? (
                    <ChevronUp className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {openIndex === index && (
                <div className="px-6 pb-6 text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
