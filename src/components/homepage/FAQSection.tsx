import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StructuredData from '@/components/SEO/StructuredData';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What makes AI automation different from traditional automation?",
    answer: "AI automation uses artificial intelligence to handle complex tasks that require decision-making and pattern recognition, unlike traditional automation which follows rigid, pre-programmed rules. AI automation can adapt to new scenarios, learn from data patterns, and handle unstructured information like natural language or images. For example, an AI-powered customer service system can understand context and intent in customer messages, while traditional automation can only respond to specific keywords. Our clients typically see 40% higher efficiency with AI automation compared to rule-based systems, as AI can handle exceptions and edge cases that would require manual intervention with traditional automation."
  },
  {
    question: "How long does AI implementation typically take?",
    answer: "The timeline for AI implementation varies based on complexity and scope. For small businesses implementing AI tools like chatbots or document processing, you can see results in 2-4 weeks. Mid-sized automation projects involving custom AI workflows typically take 6-12 weeks from planning to deployment. Enterprise-scale AI implementations with multiple integrations can take 3-6 months. We follow a phased approach: Week 1-2 for process audit and planning, Week 3-4 for tool selection and setup, Week 5-8 for implementation and testing, and ongoing optimization. Most clients start seeing ROI within the first 60 days of deployment."
  },
  {
    question: "What's the ROI timeline for AI solutions?",
    answer: "Based on data from our 50+ client implementations, most businesses see positive ROI within 3-6 months. Initial investments typically range from $3,000-$15,000 for SMBs, covering software licenses, implementation, and training. Common ROI indicators include: 35-50% reduction in operational costs within 90 days, 6.5 hours saved per employee per week on average, and 40% improvement in task accuracy. For example, one client invested $8,000 in AI-powered invoice processing and saved $2,400 monthly in labor costs—achieving full ROI in 3.3 months. The key is starting with high-impact, repetitive processes where AI can deliver immediate value."
  },
  {
    question: "Do I need technical expertise to implement AI?",
    answer: "No, you don't need to be technical to benefit from AI automation. Modern AI tools are designed for business users, with visual interfaces and no-code solutions. However, strategic guidance is valuable for choosing the right tools and designing effective workflows. That's where consulting helps—we handle the technical complexity while you focus on your business goals. Our typical client is a business owner or operations manager who understands their processes but needs expert guidance on AI implementation. We provide training, documentation, and ongoing support to ensure your team can manage and optimize AI systems independently after implementation."
  },
  {
    question: "How do you measure AI project success?",
    answer: "We measure AI project success using concrete, business-focused metrics. Primary KPIs include: Time saved (hours per week/month), cost reduction (percentage decrease in operational expenses), accuracy improvement (error rate reduction), and speed increase (tasks completed per hour). We also track adoption metrics like user engagement and system utilization. For each project, we establish baseline measurements before implementation and track progress weekly during the first month, then monthly. For example, a recent client had baseline metrics of 120 manual invoice processing hours/month with 8% error rate. After AI implementation, this dropped to 40 hours/month with 0.5% error rate—a 67% time savings and 94% accuracy improvement. We provide monthly reports with these metrics to ensure transparency and continuous optimization."
  }
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
              key={index}
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
