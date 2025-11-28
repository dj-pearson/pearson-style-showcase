import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, HelpCircle, Mail, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Connect = () => {
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Connect - Dan Pearson | AI Engineer & Business Development Expert"
        description="Get in touch for AI engineering projects, business development opportunities, or collaboration. I specialize in NFT development, AI integration, and sales leadership."
        keywords="contact Dan Pearson, AI engineer hire, business development consultant, NFT developer, AI integration services"
        url="https://danpearson.net/connect"
      />
      <Navigation />
      <main id="main-content" className="flex-1 pt-20 sm:pt-24 mobile-container">
        <div className="container mx-auto mobile-section">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="mobile-heading-lg hero-gradient-text mb-4">
                Let's Connect
              </h1>
              <p className="mobile-body text-muted-foreground">
                Ready to collaborate on your next project? I'd love to hear from you.
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
                  <h3 className="mobile-heading-sm mb-3">Email</h3>
                  <p className="text-base sm:text-base text-muted-foreground mb-4 leading-relaxed">
                    Drop me an email for project inquiries or collaboration opportunities.
                  </p>
                  <a
                    href="mailto:dan@danpearson.net"
                    className="inline-flex items-center text-base sm:text-lg text-primary hover:underline touch-target font-medium"
                  >
                    dan@danpearson.net
                  </a>
                </div>

                <div className="mobile-card border bg-card hover:border-primary/30 transition-colors">
                  <h3 className="mobile-heading-sm mb-3">LinkedIn</h3>
                  <p className="text-base sm:text-base text-muted-foreground mb-4 leading-relaxed">
                    Connect with me professionally and see my latest updates.
                  </p>
                  <a
                    href="https://www.linkedin.com/in/danpearson"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-base sm:text-lg text-primary hover:underline touch-target font-medium"
                  >
                    View Profile →
                  </a>
                </div>

                <div className="mobile-card border bg-card hover:border-primary/30 transition-colors">
                  <h3 className="mobile-heading-sm mb-3">Response Time</h3>
                  <p className="text-base sm:text-base text-muted-foreground leading-relaxed">
                    I typically respond to messages within 24 hours. For urgent matters,
                    feel free to reach out directly via email.
                  </p>
                </div>

                {/* Booking Calendar */}
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
                  <CardContent className="mobile-card text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-primary" />
                    <h3 className="mobile-heading-sm mb-3">Schedule a Call</h3>
                    <p className="text-base text-muted-foreground mb-4">
                      Prefer to talk? Book a 15-minute intro call to discuss your project.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setIsBookingDialogOpen(true)}
                    >
                      Book a Time
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Booking Dialog */}
            <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Schedule a Call
                  </DialogTitle>
                  <DialogDescription>
                    Choose how you'd like to connect for an introductory call.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-4"
                    asChild
                  >
                    <a href="mailto:dan@danpearson.net?subject=Schedule%20a%20Call&body=Hi%20Dan,%0A%0AI'd%20like%20to%20schedule%20a%20call%20to%20discuss%20a%20potential%20project.%0A%0APreferred%20times:%0A%0ABest%20regards">
                      <Mail className="w-5 h-5 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">Request via Email</div>
                        <div className="text-sm text-muted-foreground">
                          Send me your preferred times
                        </div>
                      </div>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-4"
                    asChild
                  >
                    <a
                      href="https://www.linkedin.com/in/danpearson"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-5 h-5 text-primary" />
                      <div className="text-left">
                        <div className="font-medium">Connect on LinkedIn</div>
                        <div className="text-sm text-muted-foreground">
                          Message me directly
                        </div>
                      </div>
                    </a>
                  </Button>
                  <p className="text-xs text-center text-muted-foreground pt-2">
                    I typically respond within 24 hours
                  </p>
                </div>
              </DialogContent>
            </Dialog>

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
                        I specialize in AI integration, full-stack web development (React, TypeScript, Supabase),
                        NFT development, and sales strategy consulting. I help businesses automate processes with AI,
                        build custom web applications, and optimize their sales operations.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-2">
                      <AccordionTrigger className="text-left">
                        What is your availability?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        I'm currently available for select consulting projects and collaborations. While I'm building
                        my own ventures full-time, I take on interesting projects that align with my expertise.
                        Reach out to discuss your needs and timeline.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3">
                      <AccordionTrigger className="text-left">
                        Do you work remotely or on-site?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        I work primarily remotely from the Des Moines Metropolitan Area, but I'm open to occasional
                        on-site meetings or travel for the right projects. My remote setup allows me to collaborate
                        effectively with teams across different time zones.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-4">
                      <AccordionTrigger className="text-left">
                        How do you charge for your services?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        Pricing depends on the scope and complexity of the project. I offer both project-based and
                        hourly consulting arrangements. For larger projects, I provide detailed proposals with
                        milestone-based payment structures. Contact me to discuss your specific needs and I'll
                        provide a custom quote.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-5">
                      <AccordionTrigger className="text-left">
                        What is your typical project timeline?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        Project timelines vary based on complexity. A simple AI integration might take 1-2 weeks,
                        while a full custom web application could take 4-8 weeks. I always provide realistic timelines
                        during our initial consultation and keep clients updated throughout the development process.
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-6">
                      <AccordionTrigger className="text-left">
                        Do you offer ongoing support and maintenance?
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        Yes! I offer ongoing support and maintenance packages for projects I build. This includes
                        bug fixes, updates, feature enhancements, and technical support. We can discuss the best
                        support arrangement during our initial consultation.
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