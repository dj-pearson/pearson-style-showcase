import { lazy, Suspense } from 'react';
import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import StructuredData from '../components/SEO/StructuredData';
import { Code, Zap, Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAnalytics } from '../components/Analytics';

// Lazy load below-the-fold components to improve FID
const CaseStudies = lazy(() => import('../components/CaseStudies'));
const NewsletterSignup = lazy(() => import('../components/NewsletterSignup'));
const Testimonials = lazy(() => import('../components/Testimonials'));
const CurrentVentures = lazy(() => import('../components/CurrentVentures'));
const AuthoritySection = lazy(() => import('../components/homepage/AuthoritySection'));
const FAQSection = lazy(() => import('../components/homepage/FAQSection'));

const Index = () => {
  const { trackClick } = useAnalytics();
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="AI Business Automation Consultant | Reduce Costs 40% | Dan Pearson"
        description="AI automation consultant helping businesses implement intelligent solutions that reduce operational costs by 40% on average. Serving 50+ clients with proven results. Get expert guidance on AI integration, workflow automation, and digital transformation. Based in Des Moines, serving businesses nationwide."
        keywords="AI business automation, AI automation consultant, business process automation, AI integration services, AI consultant Des Moines, AI tools for business, business automation Iowa, digital transformation consultant, AI implementation, reduce business costs with AI"
        url="https://danpearson.net"
        type="website"
      />

      {/* Enhanced Person Schema for AI Citation */}
      <StructuredData
        type="person"
        data={{
          name: 'Dan Pearson',
          jobTitle: 'AI Solutions Consultant & SaaS Developer',
          description: 'AI Solutions Consultant with 15+ years of experience helping businesses implement automation that reduces costs by an average of 40%. Built 7 SaaS platforms serving 10,000+ users and generated $2.8M+ in revenue for clients through digital transformation.',
          url: 'https://danpearson.net',
          email: 'dan@danpearson.net',
          sameAs: [
            'https://linkedin.com/in/danpearson',
            'https://github.com/dj-pearson'
          ],
          knowsAbout: [
            'AI Business Automation',
            'Artificial Intelligence Integration',
            'Business Process Automation',
            'SaaS Development',
            'Digital Transformation',
            'OpenAI Integration',
            'Claude AI Integration',
            'React Development',
            'TypeScript',
            'Cloud Architecture',
            'Business Intelligence',
            'Workflow Automation'
          ],
          worksFor: {
            '@type': 'Organization',
            name: 'Pearson Media LLC'
          },
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Des Moines',
            addressRegion: 'IA',
            addressCountry: 'US'
          },
          alumniOf: [],
          awards: [
            'Generated $2.8M+ in client revenue through AI automation',
            'Built 7 successful SaaS platforms',
            'Served 50+ businesses with AI implementation'
          ]
        }}
      />

      {/* Website Schema */}
      <StructuredData
        type="website"
        data={{
          name: 'Dan Pearson - AI Business Automation',
          description: 'Expert AI automation consulting and SaaS development services',
          url: 'https://danpearson.net'
        }}
      />

      {/* Organization/Professional Service Schema */}
      <StructuredData
        type="organization"
        data={{
          name: 'Pearson Media LLC',
          email: 'dan@danpearson.net',
          phone: ''
        }}
      />

      <Navigation />
      <HeroSection />

      {/* Authority Section - SEO Enhancement */}
      <Suspense fallback={
        <div className="mobile-section text-center">
          <div className="skeleton w-full h-96"></div>
        </div>
      }>
        <AuthoritySection />
      </Suspense>

      {/* Services Preview Section */}
      <section className="mobile-section mobile-container relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <h2 className="mobile-heading-lg text-primary mb-4">
              How I Can Help
            </h2>
            <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
              Combining cutting-edge technology with proven business strategies to deliver innovative solutions
            </p>
          </div>

          {/* Services Grid - Mobile First */}
          <div className="mobile-grid">
            {/* NFT Development */}
            <Card className="group hover:scale-[1.02] md:hover:scale-105 active:scale-[0.98] transition-all duration-300 bg-card/50 border-border hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20 cursor-pointer">
              <CardContent className="mobile-card text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Code className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>
                <h3 className="mobile-heading-sm text-foreground mb-4">NFT Development</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Unique generative collections with cutting-edge technology and mathematical precision
                </p>
              </CardContent>
            </Card>

            {/* AI Integration */}
            <Card className="group hover:scale-[1.02] md:hover:scale-105 active:scale-[0.98] transition-all duration-300 bg-card/50 border-border hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20 cursor-pointer">
              <CardContent className="mobile-card text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>
                <h3 className="mobile-heading-sm text-foreground mb-4">AI Integration</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Leveraging OpenAI, Auto-GPT, and machine learning for innovative business solutions
                </p>
              </CardContent>
            </Card>

            {/* Sales Leadership */}
            <Card className="group hover:scale-[1.02] md:hover:scale-105 active:scale-[0.98] transition-all duration-300 bg-card/50 border-border hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/20 cursor-pointer">
              <CardContent className="mobile-card text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                    <Globe className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                </div>
                <h3 className="mobile-heading-sm text-foreground mb-4">Sales Leadership</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  15+ years driving growth, building relationships, and delivering results
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="mobile-section mobile-container relative">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/30 relative overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-shadow duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <CardContent className="relative mobile-card sm:p-10 lg:p-12 text-center">
              <h2 className="mobile-heading-lg text-foreground mb-6">
                Ready to Innovate Together?
              </h2>
              <p className="mobile-body text-muted-foreground mb-8 max-w-2xl mx-auto">
                Let's combine cutting-edge technology with proven business strategies to bring your vision to life.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto">
                <Button
                  size="lg"
                  className="mobile-button btn-futuristic text-base sm:text-lg font-bold"
                  onClick={() => {
                    trackClick('View Projects CTA', 'Homepage');
                    window.location.href = '/projects';
                  }}
                >
                  View My Projects
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="mobile-button text-base sm:text-lg font-semibold border-primary/50 hover:bg-primary/10 active:bg-primary/20 hover:border-primary"
                  onClick={() => {
                    trackClick('Get In Touch CTA', 'Homepage');
                    window.location.href = '/connect';
                  }}
                >
                  Get In Touch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Current Ventures Section */}
      <section className="mobile-section mobile-container">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="mobile-heading-lg text-primary mb-4">
              Current Ventures
            </h2>
            <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
              Building 7 AI-powered SaaS platforms under Pearson Media LLC. Here's what I'm working on right now.
            </p>
          </div>
          <Suspense fallback={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton w-full h-96 rounded-lg"></div>
              ))}
            </div>
          }>
            <CurrentVentures />
          </Suspense>
        </div>
      </section>

      {/* Case Studies Section */}
      <Suspense fallback={
        <div className="mobile-section text-center">
          <div className="skeleton w-16 h-16 mx-auto mb-4 rounded-full"></div>
          <div className="skeleton w-48 h-6 mx-auto"></div>
        </div>
      }>
        <CaseStudies />
      </Suspense>

      {/* Testimonials Section */}
      <section className="mobile-section mobile-container">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="mobile-heading-lg text-primary mb-4">
              What Clients Say
            </h2>
            <p className="mobile-body text-muted-foreground max-w-3xl mx-auto">
              Don't just take my word for it. Here's what people I've worked with have to say.
            </p>
          </div>
          <Suspense fallback={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton w-full h-64 rounded-lg"></div>
              ))}
            </div>
          }>
            <Testimonials />
          </Suspense>
        </div>
      </section>

      {/* FAQ Section - SEO Enhancement */}
      <Suspense fallback={
        <div className="mobile-section text-center">
          <div className="skeleton w-full h-96"></div>
        </div>
      }>
        <FAQSection />
      </Suspense>

      {/* Newsletter Signup Section */}
      <section className="mobile-section mobile-container bg-muted/30">
        <div className="max-w-2xl mx-auto">
          <Suspense fallback={
            <div className="text-center">
              <div className="skeleton w-full h-32 mb-4"></div>
              <div className="skeleton w-full h-12"></div>
            </div>
          }>
            <NewsletterSignup />
          </Suspense>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
