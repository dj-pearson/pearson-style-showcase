import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import StructuredData from '@/components/SEO/StructuredData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, HelpCircle, ArrowRight, MessageCircle } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  display_order: number;
}

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    staleTime: 10 * 60 * 1000,
  });

  // Get unique categories
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(faqData.map(faq => faq.category))];
    return uniqueCategories.filter(Boolean);
  }, [faqData]);

  // Filter FAQs by selected category
  const filteredFAQs = useMemo(() => {
    if (!selectedCategory) return faqData;
    return faqData.filter(faq => faq.category === selectedCategory);
  }, [faqData, selectedCategory]);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="FAQ | AI Automation Questions Answered | Dan Pearson"
        description="Get answers to frequently asked questions about AI automation, business process optimization, implementation costs, and how AI can transform your business. Expert insights from an AI consultant with 50+ successful implementations."
        keywords="AI automation FAQ, AI implementation questions, business automation help, AI consulting FAQ, AI integration questions, how does AI automation work, AI automation costs, AI for small business, workflow automation FAQ"
        url="https://danpearson.net/faq"
        type="website"
      />

      {/* FAQ Page Schema - targets rich snippets for FAQ queries */}
      <StructuredData
        type="faq"
        data={{
          questions: faqData.map(item => ({
            question: item.question,
            answer: item.answer
          }))
        }}
      />

      {/* Breadcrumb Schema for better navigation in search results */}
      <StructuredData
        type="breadcrumb"
        data={{
          items: [
            { name: 'Home', url: 'https://danpearson.net' },
            { name: 'FAQ', url: 'https://danpearson.net/faq' }
          ]
        }}
      />

      <Navigation />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                <HelpCircle className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Frequently Asked Questions
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Get answers to common questions about AI automation, implementation,
                and how it can transform your business operations.
              </p>
            </div>
          </div>
        </section>

        {/* Category Filter */}
        {categories.length > 1 && (
          <section className="py-8 border-b">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="rounded-full"
                  >
                    All Questions
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className="rounded-full"
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ Content */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg"></div>
                  ))}
                </div>
              ) : filteredFAQs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No FAQs found for this category.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFAQs.map((faq, index) => (
                    <Card
                      key={faq.id}
                      className="overflow-hidden transition-all duration-200 hover:shadow-lg"
                      itemScope
                      itemType="https://schema.org/Question"
                    >
                      <button
                        onClick={() => toggleFAQ(index)}
                        className="w-full text-left p-6 flex justify-between items-start gap-4 hover:bg-muted/50 transition-colors"
                        aria-expanded={openIndex === index}
                      >
                        <h2 className="text-lg font-semibold pr-8" itemProp="name">
                          {faq.question}
                        </h2>
                        <div className="flex-shrink-0 mt-1">
                          {openIndex === index ? (
                            <ChevronUp className="w-5 h-5 text-primary" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {openIndex === index && (
                        <div
                          className="px-6 pb-6 text-muted-foreground leading-relaxed"
                          itemScope
                          itemType="https://schema.org/Answer"
                          itemProp="acceptedAnswer"
                        >
                          <p itemProp="text">{faq.answer}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-20 bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <Card className="p-8 sm:p-10 bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-6">
                    <MessageCircle className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                    Still Have Questions?
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                    Can't find the answer you're looking for? I'm here to help.
                    Reach out for a free consultation about your AI automation needs.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild size="lg" className="font-semibold">
                      <Link to="/connect">
                        Get In Touch
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link to="/about">
                        Learn About My Services
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Related Content */}
        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
                Explore More Resources
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <Link to="/news" className="group">
                  <Card className="p-6 h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50">
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                      Latest Articles
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Read in-depth guides on AI automation and business optimization.
                    </p>
                  </Card>
                </Link>
                <Link to="/ai-tools" className="group">
                  <Card className="p-6 h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50">
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                      AI Tools
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Discover the best AI tools for your business needs.
                    </p>
                  </Card>
                </Link>
                <Link to="/projects" className="group">
                  <Card className="p-6 h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50">
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">
                      Case Studies
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      See real examples of AI implementations and results.
                    </p>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
