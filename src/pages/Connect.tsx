import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import ContactForm from '../components/ContactForm';
import SEO from '../components/SEO';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';
import { useAnalytics } from '@/components/Analytics';
import { SERVICE_TIERS } from '@/lib/crm-automation';

const Connect = () => {
  const { trackOutboundLink } = useAnalytics();
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Book a CRM Automation Audit | Dan Pearson"
        description="Book a flat-fee CRM automation audit, or get in touch about capture-layer automation for your revenue team. Two weeks, findings and a roadmap you keep whoever builds it."
        keywords="CRM automation audit, book AI CRM consultant, contact Dan Pearson, CRM automation consultation, HubSpot automation help, Salesforce automation help"
        url="https://danpearson.net/connect"
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto mobile-section">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="mobile-heading-lg text-foreground mb-4">
                Book a CRM automation audit
              </h1>
              <p className="mobile-body text-muted-foreground max-w-2xl mx-auto">
                $2,500 flat, two weeks, and the findings are yours whether or not you build with me.
                Tell me which CRM you're on and what your pipeline gets wrong.
              </p>
            </div>

            <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 items-start">
              {/* Contact Form */}
              <div className="order-2 lg:order-1">
                <ContactForm />
              </div>

              {/* Contact Information */}
              <div className="order-1 lg:order-2 space-y-5">
                <div className="mobile-card border bg-card hover:border-primary/30 transition-colors">
                  <h2 className="mobile-heading-sm mb-3">Email</h2>
                  <p className="text-base sm:text-base text-muted-foreground mb-4 leading-relaxed">
                    Prefer email? Write to me directly about an audit or a build.
                  </p>
                  <a
                    href="mailto:dan@danpearson.net"
                    className="inline-flex items-center text-base sm:text-lg text-primary hover:underline touch-target font-medium"
                  >
                    dan@danpearson.net
                  </a>
                </div>

                <div className="mobile-card border bg-card hover:border-primary/30 transition-colors">
                  <h2 className="mobile-heading-sm mb-3">LinkedIn</h2>
                  <p className="text-base sm:text-base text-muted-foreground mb-4 leading-relaxed">
                    Connect with me professionally and see my latest updates.
                  </p>
                  <a
                    href="https://www.linkedin.com/in/danpearson"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-base sm:text-lg text-primary hover:underline touch-target font-medium"
                    onClick={() =>
                      trackOutboundLink(
                        'https://www.linkedin.com/in/danpearson',
                        'LinkedIn Profile - Connect Page'
                      )
                    }
                  >
                    View Profile →
                  </a>
                </div>

                <div className="mobile-card border bg-card hover:border-primary/30 transition-colors">
                  <h2 className="mobile-heading-sm mb-3">Response Time</h2>
                  <p className="text-base sm:text-base text-muted-foreground leading-relaxed">
                    I reply within one business day. If it's urgent, email me directly.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mt-16">
              <div className="text-center mb-10">
                <h2 className="mobile-heading-lg text-primary mb-4 flex items-center justify-center gap-2">
                  <HelpCircle className="w-8 h-8" />
                  Frequently Asked Questions
                </h2>
                <p className="mobile-body text-muted-foreground max-w-2xl mx-auto">
                  Have questions? Here are answers to the most common ones.
                </p>
              </div>

              <Card className="border-border bg-card/50">
                <CardContent className="mobile-card">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger className="text-left">
                        What services do you offer?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        AI CRM automation for revenue teams under 50 seats: automated call and
                        meeting logging, AI-drafted notes, enrichment, deduplication, routing and
                        evidence-backed stage changes — built into the CRM you already own.
                        Engagements start with a flat-fee two-week audit. I also build custom SaaS
                        where the job needs it.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-2">
                      <AccordionTrigger className="text-left">
                        What is your availability?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        I take a small number of audits each month. Send a note and I'll tell you
                        when the next slot opens.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3">
                      <AccordionTrigger className="text-left">
                        Do you work remotely or on-site?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        I work primarily remotely from the Des Moines Metropolitan Area, but I'm
                        open to occasional on-site meetings or travel for the right projects. My
                        remote setup allows me to collaborate effectively with teams across
                        different time zones.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-4">
                      <AccordionTrigger className="text-left">
                        How do you charge for your services?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        <p className="mb-3">
                          Every engagement starts with the audit. What comes after is priced from
                          what the audit finds.
                        </p>
                        <ul className="space-y-2">
                          {SERVICE_TIERS.map((tier) => (
                            <li key={tier.name}>
                              <span className="font-semibold text-foreground">{tier.name}</span>
                              {' - '}
                              {tier.priceLabel}, {tier.duration.toLowerCase()}. {tier.summary}
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-5">
                      <AccordionTrigger className="text-left">
                        What is your typical project timeline?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        Project timelines vary based on complexity. A simple AI integration might
                        take 1-2 weeks, while a full custom web application could take 4-8 weeks. I
                        always provide realistic timelines during our initial consultation and keep
                        clients updated throughout the development process.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-6">
                      <AccordionTrigger className="text-left">
                        Do you offer ongoing support and maintenance?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        I offer ongoing support and maintenance for projects I build. This includes
                        bug fixes, updates, feature enhancements, and technical support. We can
                        discuss the best support arrangement during our initial consultation.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Connect;
