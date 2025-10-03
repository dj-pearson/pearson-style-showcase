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
      <main className="flex-1 pt-20 sm:pt-24">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 hero-gradient-text leading-tight">
                Let's Connect
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground px-2 leading-relaxed">
                Ready to collaborate on your next project? I'd love to hear from you.
              </p>
            </div>
            
            <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 items-start">
              {/* Contact Form */}
              <div className="order-2 lg:order-1">
                <ContactForm />
              </div>
              
              {/* Contact Information */}
              <div className="order-1 lg:order-2 space-y-4 sm:space-y-6">
                <div className="p-5 sm:p-6 rounded-lg border bg-card">
                  <h3 className="text-lg sm:text-xl font-semibold mb-3">Email</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                    Drop me an email for project inquiries or collaboration opportunities.
                  </p>
                  <a 
                    href="mailto:dan@danpearson.net"
                    className="inline-flex items-center text-base text-primary hover:underline min-h-[44px] py-2"
                  >
                    dan@danpearson.net
                  </a>
                </div>
                
                <div className="p-5 sm:p-6 rounded-lg border bg-card">
                  <h3 className="text-lg sm:text-xl font-semibold mb-3">LinkedIn</h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                    Connect with me professionally and see my latest updates.
                  </p>
                  <a 
                    href="https://www.linkedin.com/in/danpearson"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-base text-primary hover:underline min-h-[44px] py-2"
                  >
                    View Profile
                  </a>
                </div>
                
                <div className="p-5 sm:p-6 rounded-lg border bg-card">
                  <h3 className="text-lg sm:text-xl font-semibold mb-3">Response Time</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
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