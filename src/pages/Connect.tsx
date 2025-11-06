import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import ContactForm from '../components/ContactForm';
import SEO from '../components/SEO';

const Connect = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Connect - Dan Pearson | AI Engineer & Business Development Expert"
        description="Get in touch for AI engineering projects, business development opportunities, or collaboration. I specialize in NFT development, AI integration, and sales leadership."
        keywords="contact Dan Pearson, AI engineer hire, business development consultant, NFT developer, AI integration services"
        url="https://danpearson.net/connect"
      />
      <Navigation />
      <main className="flex-1 pt-20 sm:pt-24 mobile-container">
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
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Connect;